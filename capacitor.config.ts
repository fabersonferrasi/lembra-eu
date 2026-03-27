import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lembraeu.app',
  appName: 'Lembra Eu',
  webDir: 'out',
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#6d28d9", // Tailwind violet-700
      sound: "beep.wav",
    },
  },
};

export default config;
