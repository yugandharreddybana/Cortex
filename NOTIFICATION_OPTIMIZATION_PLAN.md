# Notification System Optimization Plan

This plan outlines the implementation of a 3-day retention policy for acted-upon notifications and the transition from 15-second polling to a real-time WebSocket-driven architecture.

## 1. Notification Retention Policy (3-Day TTL)

### Objective
Ensure the notification list stays clean by automatically deleting notifications that satisfy these conditions:
1. They are **read** AND
2. They are **responded to** (for actionable types).
3. Once both are done, they are read and they responded, the notifications should be deleted form the UI.

### Proposed Implementation
We will add a scheduled cleanup task in the Spring Boot backend.

#### Backend Changes
- **Repository**: Add a custom delete query in `NotificationRepository.java`.
  ```java
  @Modifying
  @Transactional
  @Query("DELETE FROM Notification n WHERE n.createdAt < :cutoff AND (n.isRead = true OR n.responded IS NOT NULL)")
  void deleteOldActedNotifications(@Param("cutoff") Instant cutoff);
  ```
- **Service/Task**: Create a `NotificationCleanupTask.java` with a `@Scheduled` cron job that runs daily at midnight.
  ```java
  @Scheduled(cron = "0 0 0 * * *")
  public void cleanup() {
      Instant cutoff = Instant.now().minus(3, ChronoUnit.DAYS);
      notifRepo.deleteOldActedNotifications(cutoff);
  }
  ```

---

## 2. Real-Time Notification Updates (WebSocket)

### Objective
Remove the `setInterval` polling in `NotificationBell.tsx` and replace it with a subscription to a user-specific WebSocket topic. This reduces server load and provides instant visual feedback.

### Current Architecture
- Backend already has `WebSocketConfig` and `NotificationService.broadcast()`.
- Notifications are currently broadcasted to `/topic/notifications/{userId}`.

### Proposed Implementation

#### Frontend Changes (`NotificationBell.tsx`)
- **Phase Out Polling**: Remove `fetchUnreadCount` and the `setInterval` logic.
- **WebSocket Hook**: Use a custom `useNotificationSocket` hook or integrate with the existing `useServerSync` logic to subscribe to the notification topic.
- **Message Handling**:
  - When a message arrives on `/user/queue/notifications`, increment the `unreadCount` and (if the popover is open) prepend the new notification to the list.
  - Trigger a small "ping" animation on the bell.

#### Backend Refinement
- Ensure `NotificationService` uses the correct user-destination prefix for privacy.
- Change `broadcast` to use `convertAndSendToUser` to target the specific session securely.
  ```java
  messaging.convertAndSendToUser(
      recipient.getId().toString(), 
      "/queue/notifications", 
      notificationDto
  );
  ```

---

## 3. Implementation Steps

| Step | Task | File(s) |
| :--- | :--- | :--- |
| **1** | Add TTL Delete Query | `NotificationRepository.java` |
| **2** | Create Scheduled Cleanup Job | `NotificationCleanupTask.java` |
| **3** | Secure WebSocket Broadcasting | `NotificationService.java` |
| **4** | Replace Polling with STOMP Subscription | `NotificationBell.tsx` |
| **5** | Verification | Run full E2E test of access request -> instant notification |

## 4. Why This Architecture?
- **Efficiency**: WebSockets use a single persistent connection instead of firing HTTP requests every 15 seconds (5,760 requests per user per day).
- **Reduced Database Bloat**: Daily cleanup prevents the `notifications` table from growing indefinitely, keeping queries fast.
- **Scalability**: The system becomes event-driven, which is better for high-concurrency collaboration.
