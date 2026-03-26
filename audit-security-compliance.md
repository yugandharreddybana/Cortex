# Security & Compliance Audit

## Security Vulnerabilities & Risks

1. **CORS Misconfiguration in API (`apps/api/src/main/java/com/cortex/api/config/SecurityConfig.java`)**
   - **Risk:** The API is configured to allow `chrome-extension://*` via `addAllowedOriginPattern` while also setting `setAllowCredentials(true)`. Combining wildcard origin patterns (even partial ones like `chrome-extension://*`) with `allowCredentials(true)` is a major security vulnerability that can lead to cross-origin exploitation.
   - **Recommendation:** Do not use wildcard origins when `allowCredentials` is true. Limit origins strictly via the `cors.allowed-origins` property.

2. **Weak JWT Secret Handling & Defaults (`apps/api/src/main/resources/application.yml`)**
   - **Risk:** The JWT secret fallback is set to `your-256-bit-secret`. Same for the Encryption Key (`Kclxcd...`). If `application.yml` is packaged in production without environment variables correctly supplied, the application will use known default secrets, making it completely insecure.
   - **Recommendation:** Do not provide default fallback values for secrets in configuration files. The application should fail to start if `CORTEX_JWT_SECRET`, `CORTEX_ENCRYPTION_KEY`, and database credentials are not provided via environment variables.

3. **Insecure Password Encryption Defaults (`apps/api/src/main/java/com/cortex/api/config/SecurityConfig.java`)**
   - **Risk:** The BCrypt password encoder uses strength `12`. While acceptable, modern standards often recommend `14` or Argon2id to resist brute forcing with modern hardware.
   - **Recommendation:** Consider upgrading to Argon2 or increasing the BCrypt cost factor if acceptable for performance.

4. **Missing Content Security Policy (CSP) Headers in Web App (`apps/web/next.config.ts`)**
   - **Risk:** `next.config.ts` does not enforce strict HTTP security headers (e.g., CSP, X-Frame-Options, X-Content-Type-Options).
   - **Recommendation:** Implement comprehensive security headers in Next.js to mitigate XSS and Clickjacking attacks.

5. **Broad Extension Permissions (`apps/extension/manifest.json`)**
   - **Risk:** The extension requests `<all_urls>` for content scripts and extremely broad `host_permissions` including all of localhost.
   - **Recommendation:** Follow the Principle of Least Privilege. Only request permissions absolutely necessary, and consider optional permissions for `<all_urls>` to respect user privacy.

6. **Authentication Filter Fallback (`apps/api/src/main/java/com/cortex/api/config/JwtAuthFilter.java`)**
   - **Risk:** The filter falls back to accepting tokens via query parameter (`?token=`). This makes tokens visible in URLs, which can be logged in proxy servers, browser history, or referer headers.
   - **Recommendation:** Restrict token-via-query-parameter strictly to WebSocket connection endpoints (`/ws/**`), and do not allow it for standard HTTP REST calls.

## Compliance (GDPR, CCPA, SOC2)

1. **Data Deletion (Right to be Forgotten)**
   - Need to ensure when a user deletes their account, all related data (highlights, folders, PII) is either hard-deleted or irreversibly anonymized. (Requires checking the User/Account deletion logic).

2. **Data Export (Right to Portability)**
   - The API documentation mentions Universal Export (`/api/v1/export`), which is good for GDPR. Ensure it encompasses all user data.

3. **Consent and Cookie Management**
   - No evidence of a cookie consent banner in the frontend structure for tracking cookies. Next.js `session.ts` uses strictly functional session cookies (which are exempt from consent), but if analytics or third-party tools are added, a consent management platform (CMP) is necessary.
