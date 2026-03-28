import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lembraeu.app',
  appName: 'Lembra Eu',
  webDir: 'out',
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#6d28d9", // Tailwind violet-700
    },
  },
};

export default config;
