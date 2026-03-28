package com.lembraeu.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

public class ReminderReceiver extends BroadcastReceiver {
    private static final String TAG = "ReminderReceiver";
    public static final String CHANNEL_ID = "lembra_eu_reminders";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) {
            return;
        }

        int requestCodeBase = intent.getIntExtra(NativeRemindersPlugin.EXTRA_REQUEST_CODE_BASE, 0);
        int taskId = intent.getIntExtra(NativeRemindersPlugin.EXTRA_TASK_ID, 0);
        String occurrenceKey = intent.getStringExtra(NativeRemindersPlugin.EXTRA_OCCURRENCE_KEY);
        String occurrenceDate = intent.getStringExtra(NativeRemindersPlugin.EXTRA_OCCURRENCE_DATE);
        String occurrenceTime = intent.getStringExtra(NativeRemindersPlugin.EXTRA_OCCURRENCE_TIME);
        String fallbackTitle = intent.getStringExtra(NativeRemindersPlugin.EXTRA_TITLE);
        String fallbackBody = intent.getStringExtra(NativeRemindersPlugin.EXTRA_BODY);
        String alarmType = intent.getStringExtra(NativeRemindersPlugin.EXTRA_ALARM_TYPE);

        JSONObject entry = NativeRemindersPlugin.getStoredOccurrence(context, occurrenceKey);
        String title = fallbackTitle;
        String body = fallbackBody;

        if (entry != null) {
            if (NativeRemindersPlugin.ALARM_TYPE_EARLY.equals(alarmType)) {
                title = entry.optString("earlyTitle", fallbackTitle == null ? "Prepara: lembrete" : fallbackTitle);
                body = entry.optString("earlyBody", fallbackBody == null ? "Seu lembrete esta chegando." : fallbackBody);
            } else {
                title = entry.optString(NativeRemindersPlugin.EXTRA_TITLE, fallbackTitle == null ? "Lembrete" : fallbackTitle);
                body = entry.optString(NativeRemindersPlugin.EXTRA_BODY, fallbackBody == null ? "Abra o app e confirme este lembrete." : fallbackBody);
            }
        }

        if (title == null || title.trim().isEmpty()) {
            title = NativeRemindersPlugin.ALARM_TYPE_EARLY.equals(alarmType) ? "Prepara: lembrete" : "Lembrete";
        }
        if (body == null || body.trim().isEmpty()) {
            body = NativeRemindersPlugin.ALARM_TYPE_EARLY.equals(alarmType)
                ? "Seu lembrete esta chegando."
                : "Abra o app e confirme este lembrete.";
        }

        NotificationManager notificationManager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) {
            Log.e(TAG, "NotificationManager unavailable");
            return;
        }

        ensureChannel(notificationManager);

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra(NativeRemindersPlugin.EXTRA_TASK_ID, taskId);
        launchIntent.putExtra(NativeRemindersPlugin.EXTRA_OCCURRENCE_KEY, occurrenceKey);
        launchIntent.putExtra(NativeRemindersPlugin.EXTRA_OCCURRENCE_DATE, occurrenceDate);
        launchIntent.putExtra(NativeRemindersPlugin.EXTRA_OCCURRENCE_TIME, occurrenceTime);

        PendingIntent tapIntent = PendingIntent.getActivity(
            context,
            requestCodeBase + 500000,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        int notificationId = NativeRemindersPlugin.ALARM_TYPE_EARLY.equals(alarmType)
            ? requestCodeBase + 1
            : requestCodeBase + 2;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(tapIntent)
            .setSound(sound)
            .setVibrate(new long[]{0, 350, 200, 350});

        try {
            notificationManager.notify(notificationId, builder.build());
            if (!NativeRemindersPlugin.ALARM_TYPE_EARLY.equals(alarmType)) {
                notificationManager.cancel(requestCodeBase + 1);
            }
        } catch (Exception error) {
            Log.e(TAG, "Failed to post notification for occurrence=" + occurrenceKey, error);
        }

        if (entry != null && (
            NativeRemindersPlugin.ALARM_TYPE_MAIN.equals(alarmType) ||
            NativeRemindersPlugin.ALARM_TYPE_NAG.equals(alarmType)
        )) {
            long nextNagAt = NativeRemindersPlugin.scheduleNextNag(context, entry, System.currentTimeMillis());
            if (nextNagAt <= 0L && System.currentTimeMillis() > entry.optLong("nagEndAt", 0L)) {
                NativeRemindersPlugin.removeStoredOccurrence(context, occurrenceKey);
            }
        }
    }

    static void ensureChannel(NotificationManager notificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Lembretes do Lembra Eu",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Notificacoes de lembretes persistentes");
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 350, 200, 350});

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
            .build();
        channel.setSound(sound, attrs);

        notificationManager.createNotificationChannel(channel);
    }
}
