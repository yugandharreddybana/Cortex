package com.cortex.api.service;

import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class StripeService {

    private final UserRepository userRepository;
    private final String stripeWebhookSecret;
    private final EmailService emailService;

    public StripeService(
            UserRepository userRepository,
            EmailService emailService,
            @Value("${cortex.stripe.api-key:sk_test_123}") String stripeApiKey,
            @Value("${cortex.stripe.webhook-secret:whsec_123}") String stripeWebhookSecret) {
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.stripeWebhookSecret = stripeWebhookSecret;
        Stripe.apiKey = stripeApiKey;
    }

    @Transactional
    public String createCheckoutSession(User user, String planId, Boolean isAnnual, String successUrl, String cancelUrl) throws StripeException {
        String customerId = user.getStripeCustomerId();

        if (customerId == null || customerId.isEmpty()) {
            // Create Stripe customer
            com.stripe.param.CustomerCreateParams customerParams =
                    com.stripe.param.CustomerCreateParams.builder()
                            .setEmail(user.getEmail())
                            .setName(user.getFullName())
                            .build();
            Customer customer = Customer.create(customerParams);
            customerId = customer.getId();
            user.setStripeCustomerId(customerId);
            userRepository.save(user);
        }

        // If the user selects the free starter plan, just redirect them to success
        if ("starter".equals(planId)) {
            return successUrl;
        }

        // Generate dynamic price payload for dummy testing
        long unitAmount = 0L;
        String productName = "Cortex " + planId.substring(0, 1).toUpperCase() + planId.substring(1);
        if ("pro".equals(planId)) {
            unitAmount = isAnnual ? 9600L : 1000L; // $96/yr or $10/mo
        } else if ("team".equals(planId)) {
            unitAmount = isAnnual ? 24000L : 2500L; // $240/yr or $25/mo
        } else {
            throw new IllegalArgumentException("Invalid plan tier: " + planId);
        }

        SessionCreateParams.LineItem.PriceData.Recurring.Interval interval =
            isAnnual ? SessionCreateParams.LineItem.PriceData.Recurring.Interval.YEAR : SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH;

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setCustomer(customerId)
                .setSuccessUrl(successUrl)
                .setCancelUrl(cancelUrl)
                .putMetadata("tier", planId)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency("usd")
                                .setUnitAmount(unitAmount)
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName(productName)
                                        .build())
                                .setRecurring(SessionCreateParams.LineItem.PriceData.Recurring.builder()
                                        .setInterval(interval)
                                        .build())
                                .build())
                        .build())
                .build();

        Session session = Session.create(params);
        return session.getUrl();
    }

    @Transactional
    public String createPortalSession(User user, String returnUrl) throws StripeException {
        String customerId = user.getStripeCustomerId();
        if (customerId == null || customerId.isEmpty()) {
             throw new IllegalArgumentException("User does not have an active subscription.");
        }

        com.stripe.param.billingportal.SessionCreateParams params =
            com.stripe.param.billingportal.SessionCreateParams.builder()
                .setCustomer(customerId)
                .setReturnUrl(returnUrl)
                .build();

        com.stripe.model.billingportal.Session session = com.stripe.model.billingportal.Session.create(params);
        return session.getUrl();
    }

    @Transactional
    public void handleWebhook(String payload, String sigHeader) throws Exception {
        Event event = Webhook.constructEvent(payload, sigHeader, stripeWebhookSecret);

        if ("checkout.session.completed".equals(event.getType())) {
            Session session = (Session) event.getDataObjectDeserializer().getObject().orElse(null);
            if (session != null) {
                 handleCheckoutSessionCompleted(session);
            }
        } else if ("customer.subscription.created".equals(event.getType()) || "customer.subscription.updated".equals(event.getType()) || "customer.subscription.deleted".equals(event.getType())) {
            Subscription subscription = (Subscription) event.getDataObjectDeserializer().getObject().orElse(null);
            if (subscription != null) {
                handleSubscriptionUpdated(subscription);
            }
        } else if ("invoice.upcoming".equals(event.getType())) {
            Invoice invoice = (Invoice) event.getDataObjectDeserializer().getObject().orElse(null);
            if (invoice != null) {
                handleUpcomingInvoice(invoice);
            }
        }
    }

    private void handleCheckoutSessionCompleted(Session session) {
        String customerId = session.getCustomer();
        Optional<User> userOpt = userRepository.findByStripeCustomerId(customerId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setSubscriptionStatus("active");

            String tier = "pro";
            if (session.getMetadata() != null && session.getMetadata().containsKey("tier")) {
                tier = session.getMetadata().get("tier");
            }
            user.setTier(tier);

            // Fallback for currentPeriodEnd if the subscription update webhook arrives late
            if (user.getCurrentPeriodEnd() == null) {
                user.setCurrentPeriodEnd(java.time.Instant.now().plus(30, java.time.temporal.ChronoUnit.DAYS));
            }

            userRepository.save(user);
        }
    }

    private void handleSubscriptionUpdated(Subscription subscription) {
        String customerId = subscription.getCustomer();
        Optional<User> userOpt = userRepository.findByStripeCustomerId(customerId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setSubscriptionStatus(subscription.getStatus());

            // Set the billing interval and current period end date
            if (subscription.getItems() != null && !subscription.getItems().getData().isEmpty()) {
                com.stripe.model.SubscriptionItem item = subscription.getItems().getData().get(0);
                if (item.getPrice() != null && item.getPrice().getRecurring() != null) {
                    user.setBillingInterval(item.getPrice().getRecurring().getInterval());
                }
            }

            user.setCurrentPeriodEnd(java.time.Instant.ofEpochSecond(subscription.getCurrentPeriodEnd()));

            if (!"active".equals(subscription.getStatus()) && !"trialing".equals(subscription.getStatus())) {
                 user.setTier("starter");
            }

            userRepository.save(user);
        }
    }

    private void handleUpcomingInvoice(Invoice invoice) {
        String customerId = invoice.getCustomer();
        Optional<User> userOpt = userRepository.findByStripeCustomerId(customerId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            long amountDue = invoice.getAmountDue();
            String currency = invoice.getCurrency() != null ? invoice.getCurrency() : "usd";
            java.time.Instant nextPaymentAttempt = invoice.getNextPaymentAttempt() != null ?
                java.time.Instant.ofEpochSecond(invoice.getNextPaymentAttempt()) :
                java.time.Instant.ofEpochSecond(invoice.getPeriodEnd());

            emailService.sendSubscriptionRenewalReminder(user.getEmail(), amountDue, currency, nextPaymentAttempt);
        }
    }
}
