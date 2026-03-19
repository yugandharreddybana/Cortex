package com.cortex.api.service;

import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
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

    public StripeService(
            UserRepository userRepository,
            @Value("${cortex.stripe.api-key:sk_test_123}") String stripeApiKey,
            @Value("${cortex.stripe.webhook-secret:whsec_123}") String stripeWebhookSecret) {
        this.userRepository = userRepository;
        this.stripeWebhookSecret = stripeWebhookSecret;
        Stripe.apiKey = stripeApiKey;
    }

    @Transactional
    public String createCheckoutSession(User user, String priceId, String successUrl, String cancelUrl) throws StripeException {
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

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setCustomer(customerId)
                .setSuccessUrl(successUrl)
                .setCancelUrl(cancelUrl)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setPrice(priceId)
                        .setQuantity(1L)
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
        } else if ("customer.subscription.updated".equals(event.getType()) || "customer.subscription.deleted".equals(event.getType())) {
            Subscription subscription = (Subscription) event.getDataObjectDeserializer().getObject().orElse(null);
            if (subscription != null) {
                handleSubscriptionUpdated(subscription);
            }
        }
    }

    private void handleCheckoutSessionCompleted(Session session) {
        String customerId = session.getCustomer();
        Optional<User> userOpt = userRepository.findByStripeCustomerId(customerId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setSubscriptionStatus("active");
            // Simplified tier assignment for now based on completion
            user.setTier("premium"); // In a real app, infer from the line items/price ID
            userRepository.save(user);
        }
    }

    private void handleSubscriptionUpdated(Subscription subscription) {
        String customerId = subscription.getCustomer();
        Optional<User> userOpt = userRepository.findByStripeCustomerId(customerId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setSubscriptionStatus(subscription.getStatus());
            if (!"active".equals(subscription.getStatus()) && !"trialing".equals(subscription.getStatus())) {
                 user.setTier("starter");
            }
            userRepository.save(user);
        }
    }
}
