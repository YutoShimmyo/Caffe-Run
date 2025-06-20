"use client";

import { usePushNotifications } from "@/hooks/UsePushNotifications";

/**
 * This is a non-rendering component that triggers the push notification setup logic
 * on initial page load. The hook itself contains the logic to prompt for permissions
 * on the first visit.
 */
const NotificationInitializer: React.FC = () => {
  usePushNotifications();

  // This component does not render anything to the DOM.
  return null;
};

export default NotificationInitializer;
