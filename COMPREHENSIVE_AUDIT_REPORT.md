# Comprehensive System Audit Report - Cortex
**Date:** $(date "+%Y-%m-%d %H:%M:%S")

## 1. Executive Summary
This report outlines the findings from a comprehensive audit across all three components of the Cortex system: Java API, Next.js Web App, and Browser Extension. The goal is to maximize user utility and market competitiveness, targeting both academic researchers and general knowledge workers.

## 2. Priority Sub-Tasks

### 2.1. Critical Security & Subscription Validations
**High Priority - Immediate Implementation Needed**
* **Stripe Subscription Integration (Backend & Frontend):**
    * Add `stripeCustomerId`, `subscriptionPlan` (Starter/Plus/Premium), and `subscriptionStatus` to the `User` entity.
    * Implement API endpoints for Stripe Checkout and Webhooks.
    * Add backend validation logic (interceptors/AOP) to gate API access based on the user's tier.
    * Integrate Stripe Checkout into the Next.js frontend and display the current tier.

### 2.2. Product/UX Improvements (Market Advantage)
**High Priority**
* **Offline Synchronization Robustness:** Enhance the `sync-queue.ts` in the frontend to handle conflict resolution when highlights are modified from both the web and extension simultaneously.
* **Unified Search & Discovery:** Implement an AI-powered semantic search across all saved highlights and folders, replacing basic keyword search. This is crucial for users with long AI chat histories.
* **Smart Tagging:** Automatically suggest tags for highlights based on the content using a lightweight local NLP model or API.

### 2.3. Technical Debt & Performance
**Medium Priority**
* **API Performance (N+1 Queries):** Ensure all new repository methods use `JOIN FETCH` or batching to prevent N+1 query problems, especially when fetching folders with nested highlights.
* **Database Optimization:** Review PostgreSQL connection pool settings (`HikariCP`) to ensure they scale adequately under heavy extension usage.
* **Frontend Rendering:** Implement virtualization for the highlight feed in Next.js to prevent memory leaks and slow rendering when users have thousands of saved highlights.

### 2.4. Code Quality
**Low Priority**
* **Consistent Error Handling:** Standardize API error responses using a unified JSON format (e.g., `ProblemDetail` from RFC 7807) to simplify frontend error parsing.

## 3. Next Steps
The immediate next step is the implementation of the **Stripe Subscription Integration** (Sub-Task 2.1), which will be executed following this report.
