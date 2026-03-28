package com.lembraeu.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@CapacitorPlugin(name = "NativeReminders")
public class NativeRemindersPlugin extends Plugin {
    static final String TAG = "NativeReminders";
    static final String PREFS_NAME = "LembraEuPrefs";
    static final String KEY_STORED_OCCURRENCES = "nativeReminderOccurrences";
    static final String ACTION_REMINDER = "com.lembraeu.app.ACTION_REMINDER";
    static final String EXTRA_REQUEST_CODE_BASE = "requestCodeBase";
    static final String EXTRA_TASK_ID = "taskId";
    static final String EXTRA_OCCURRENCE_KEY = "occurrenceKey";
    static final String EXTRA_OCCURRENCE_DATE = "occurrenceDate";
    static final String EXTRA_OCCURRENCE_TIME = "scheduledTime";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    static final String EXTRA_ALARM_TYPE = "alarmType";
    static final String ALARM_TYPE_EARLY = "early";
    static final String ALARM_TYPE_MAIN = "main";
    static final String ALARM_TYPE_NAG = "nag";

    @PluginMethod
    public void syncTask(PluginCall call) {
        Integer taskId = call.getInt("taskId");
        JSArray occurrences = call.getArray("occurrences");

        if (taskId == null || taskId <= 0) {
            call.reject("taskId invalido");
            return;
        }

        cancelTaskAlarms(getContext(), taskId);

        JSONObject store = loadStoredOccurrences(getContext());
        long now = System.currentTimeMillis();
        int scheduled = 0;

        if (occurrences != null) {
            for (int index = 0; index < occurrences.length(); index++) {
                JSONObject item = occurrences.optJSONObject(index);
                if (item == null) {
                    continue;
                }

                JSONObject normalized = normalizeOccurrence(item);
                if (normalized == null) {
                    continue;
                }

                int count = scheduleOccurrence(getContext(), normalized, now);
                if (count <= 0) {
                    continue;
                }

                scheduled += count;
                try {
                    store.put(normalized.optString(EXTRA_OCCURRENCE_KEY, ""), normalized);
                } catch (JSONException error) {
                    Log.w(TAG, "Failed to store occurrence for taskId=" + taskId, error);
                }
            }
        }

        saveStoredOccurrences(getContext(), store);

        JSObject result = new JSObject();
        result.put("scheduled", scheduled);
        call.resolve(result);
    }

    @PluginMethod
    public void cancelTask(PluginCall call) {
        Integer taskId = call.getInt("taskId");
        if (taskId != null && taskId > 0) {
            cancelTaskAlarms(getContext(), taskId);
        }
        call.resolve();
    }

    @PluginMethod
    public void testAlarm(PluginCall call) {
        Context context = getContext();
        AlarmManager alarmManager = getAlarmManager(context);
        if (alarmManager == null) {
            call.reject("AlarmManager indisponivel");
            return;
        }

        long fireAt = System.currentTimeMillis() + 5000L;
        int base = 9900000;
        boolean scheduled = scheduleAlarm(
            context,
            alarmManager,
            base + 2,
            base,
            0,
            "__test__",
            "",
            "",
            "Teste: Lembra Eu",
            "Se voce esta vendo esta notificacao, o sistema nativo esta funcionando.",
            ALARM_TYPE_MAIN,
            fireAt
        );

        if (!scheduled) {
            call.reject("Falha ao agendar notificacao de teste");
            return;
        }

        call.resolve();
    }

    static int cancelTaskAlarms(Context context, int taskId) {
        JSONObject store = loadStoredOccurrences(context);
        JSONObject updated = new JSONObject();
        int cancelled = 0;

        Iterator<String> keys = store.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            JSONObject entry = store.optJSONObject(key);
            if (entry == null) {
                continue;
            }

            if (entry.optInt(EXTRA_TASK_ID, 0) == taskId) {
                cancelOccurrence(context, entry);
                cancelled++;
            } else {
                try {
                    updated.put(key, entry);
                } catch (JSONException ignored) {
                }
            }
        }

        saveStoredOccurrences(context, updated);
        return cancelled;
    }

    static int restoreScheduledAlarms(Context context) {
        JSONObject store = loadStoredOccurrences(context);
        JSONObject updated = new JSONObject();
        int restored = 0;
        long now = System.currentTimeMillis();

        Iterator<String> keys = store.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            JSONObject entry = store.optJSONObject(key);
            if (entry == null) {
                continue;
            }

            int count = scheduleOccurrence(context, entry, now);
            if (count <= 0) {
                continue;
            }

            restored += count;
            try {
                updated.put(key, entry);
            } catch (JSONException ignored) {
            }
        }

        saveStoredOccurrences(context, updated);
        return restored;
    }

    static JSONObject getStoredOccurrence(Context context, String occurrenceKey) {
        if (occurrenceKey == null || occurrenceKey.trim().isEmpty()) {
            return null;
        }

        JSONObject store = loadStoredOccurrences(context);
        return store.optJSONObject(occurrenceKey);
    }

    static void removeStoredOccurrence(Context context, String occurrenceKey) {
        if (occurrenceKey == null || occurrenceKey.trim().isEmpty()) {
            return;
        }

        JSONObject store = loadStoredOccurrences(context);
        store.remove(occurrenceKey);
        saveStoredOccurrences(context, store);
    }

    static long scheduleNextNag(Context context, JSONObject entry, long now) {
        if (entry == null) {
            return -1L;
        }

        long mainAt = entry.optLong("mainAt", 0L);
        long nagEndAt = entry.optLong("nagEndAt", 0L);
        int intervalMinutes = Math.max(1, entry.optInt("nagIntervalMinutes", 2));
        long nextNagAt = computeNextNagAt(now, mainAt, intervalMinutes);

        if (nextNagAt <= 0L || nextNagAt > nagEndAt) {
            if (nagEndAt > 0L && now > nagEndAt) {
                removeStoredOccurrence(context, entry.optString(EXTRA_OCCURRENCE_KEY, ""));
            }
            return -1L;
        }

        int base = entry.optInt("requestCodeBase", 0);
        AlarmManager alarmManager = getAlarmManager(context);
        if (alarmManager == null) {
            return -1L;
        }

        boolean scheduled = scheduleAlarm(
            context,
            alarmManager,
            base + 3,
            base,
            entry.optInt(EXTRA_TASK_ID, 0),
            entry.optString(EXTRA_OCCURRENCE_KEY, ""),
            entry.optString(EXTRA_OCCURRENCE_DATE, ""),
            entry.optString(EXTRA_OCCURRENCE_TIME, ""),
            entry.optString(EXTRA_TITLE, "Lembrete"),
            entry.optString(EXTRA_BODY, "Abra o app e confirme este lembrete."),
            ALARM_TYPE_NAG,
            nextNagAt
        );

        return scheduled ? nextNagAt : -1L;
    }

    static void cancelOccurrence(Context context, JSONObject entry) {
        if (entry == null) {
            return;
        }

        AlarmManager alarmManager = getAlarmManager(context);
        if (alarmManager == null) {
            return;
        }

        int base = entry.optInt("requestCodeBase", 0);
        cancelAlarm(context, alarmManager, base + 1);
        cancelAlarm(context, alarmManager, base + 2);
        cancelAlarm(context, alarmManager, base + 3);

        NotificationManager notificationManager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(base + 1);
            notificationManager.cancel(base + 2);
        }
    }

    private static JSONObject normalizeOccurrence(JSONObject source) {
        int requestCodeBase = source.optInt("requestCodeBase", 0);
        int taskId = source.optInt(EXTRA_TASK_ID, 0);
        String occurrenceKey = source.optString(EXTRA_OCCURRENCE_KEY, "");
        long mainAt = source.optLong("mainAt", 0L);
        long nagEndAt = source.optLong("nagEndAt", 0L);

        if (requestCodeBase <= 0 || taskId <= 0 || occurrenceKey.trim().isEmpty() || mainAt <= 0L || nagEndAt <= 0L) {
            return null;
        }

        JSONObject normalized = new JSONObject();
        try {
            normalized.put("requestCodeBase", requestCodeBase);
            normalized.put(EXTRA_TASK_ID, taskId);
            normalized.put(EXTRA_OCCURRENCE_KEY, occurrenceKey);
            normalized.put(EXTRA_OCCURRENCE_DATE, source.optString(EXTRA_OCCURRENCE_DATE, ""));
            normalized.put(EXTRA_OCCURRENCE_TIME, source.optString(EXTRA_OCCURRENCE_TIME, ""));
            normalized.put(EXTRA_TITLE, source.optString(EXTRA_TITLE, "Lembrete"));
            normalized.put(EXTRA_BODY, source.optString(EXTRA_BODY, "Abra o app e confirme este lembrete."));
            normalized.put("earlyTitle", source.optString("earlyTitle", ""));
            normalized.put("earlyBody", source.optString("earlyBody", ""));
            normalized.put("earlyAt", source.optLong("earlyAt", 0L));
            normalized.put("mainAt", mainAt);
            normalized.put("nagEndAt", nagEndAt);
            normalized.put("nagIntervalMinutes", Math.max(1, source.optInt("nagIntervalMinutes", 2)));
        } catch (JSONException error) {
            Log.w(TAG, "normalizeOccurrence failed", error);
            return null;
        }

        return normalized;
    }

    private static int scheduleOccurrence(Context context, JSONObject entry, long now) {
        AlarmManager alarmManager = getAlarmManager(context);
        if (alarmManager == null) {
            return 0;
        }

        int base = entry.optInt("requestCodeBase", 0);
        int taskId = entry.optInt(EXTRA_TASK_ID, 0);
        String occurrenceKey = entry.optString(EXTRA_OCCURRENCE_KEY, "");
        String occurrenceDate = entry.optString(EXTRA_OCCURRENCE_DATE, "");
        String scheduledTime = entry.optString(EXTRA_OCCURRENCE_TIME, "");
        String title = entry.optString(EXTRA_TITLE, "Lembrete");
        String body = entry.optString(EXTRA_BODY, "Abra o app e confirme este lembrete.");
        String earlyTitle = entry.optString("earlyTitle", "");
        String earlyBody = entry.optString("earlyBody", "");
        long earlyAt = entry.optLong("earlyAt", 0L);
        long mainAt = entry.optLong("mainAt", 0L);
        long nagEndAt = entry.optLong("nagEndAt", 0L);
        int intervalMinutes = Math.max(1, entry.optInt("nagIntervalMinutes", 2));

        int scheduled = 0;

        if (earlyAt > now) {
            boolean earlyScheduled = scheduleAlarm(
                context,
                alarmManager,
                base + 1,
                base,
                taskId,
                occurrenceKey,
                occurrenceDate,
                scheduledTime,
                earlyTitle.isEmpty() ? "Prepara: " + title : earlyTitle,
                earlyBody.isEmpty() ? body : earlyBody,
                ALARM_TYPE_EARLY,
                earlyAt
            );
            if (earlyScheduled) {
                scheduled++;
            }
        }

        if (mainAt > now) {
            boolean mainScheduled = scheduleAlarm(
                context,
                alarmManager,
                base + 2,
                base,
                taskId,
                occurrenceKey,
                occurrenceDate,
                scheduledTime,
                title,
                body,
                ALARM_TYPE_MAIN,
                mainAt
            );
            if (mainScheduled) {
                scheduled++;
            }
        } else {
            long nextNagAt = computeNextNagAt(now, mainAt, intervalMinutes);
            if (nextNagAt > 0L && nextNagAt <= nagEndAt) {
                boolean nagScheduled = scheduleAlarm(
                    context,
                    alarmManager,
                    base + 3,
                    base,
                    taskId,
                    occurrenceKey,
                    occurrenceDate,
                    scheduledTime,
                    title,
                    body,
                    ALARM_TYPE_NAG,
                    nextNagAt
                );
                if (nagScheduled) {
                    scheduled++;
                }
            }
        }

        return scheduled;
    }

    static long computeNextNagAt(long now, long mainAt, int intervalMinutes) {
        if (mainAt <= 0L || intervalMinutes <= 0) {
            return -1L;
        }

        long intervalMs = intervalMinutes * 60L * 1000L;
        long firstNagAt = mainAt + intervalMs;

        if (now <= firstNagAt) {
            return firstNagAt;
        }

        long elapsed = now - firstNagAt;
        long steps = elapsed / intervalMs;
        long candidate = firstNagAt + (steps * intervalMs);
        if (candidate <= now) {
            candidate += intervalMs;
        }
        return candidate;
    }

    private static boolean scheduleAlarm(
        Context context,
        AlarmManager alarmManager,
        int requestCode,
        int requestCodeBase,
        int taskId,
        String occurrenceKey,
        String occurrenceDate,
        String occurrenceTime,
        String title,
        String body,
        String alarmType,
        long fireAt
    ) {
        Intent reminderIntent = new Intent(context, ReminderReceiver.class);
        reminderIntent.setAction(ACTION_REMINDER + "." + requestCode);
        reminderIntent.putExtra(EXTRA_REQUEST_CODE_BASE, requestCodeBase);
        reminderIntent.putExtra(EXTRA_TASK_ID, taskId);
        reminderIntent.putExtra(EXTRA_OCCURRENCE_KEY, occurrenceKey);
        reminderIntent.putExtra(EXTRA_OCCURRENCE_DATE, occurrenceDate);
        reminderIntent.putExtra(EXTRA_OCCURRENCE_TIME, occurrenceTime);
        reminderIntent.putExtra(EXTRA_TITLE, title);
        reminderIntent.putExtra(EXTRA_BODY, body);
        reminderIntent.putExtra(EXTRA_ALARM_TYPE, alarmType);

        PendingIntent operation = PendingIntent.getBroadcast(
            context,
            requestCode,
            reminderIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            if (canScheduleExactAlarms(context)) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, operation);
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, operation);
            }
            return true;
        } catch (SecurityException error) {
            Log.w(TAG, "Exact alarm denied for requestCode=" + requestCode, error);
            try {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, operation);
                return true;
            } catch (Exception fallbackError) {
                Log.e(TAG, "Failed to schedule alarm requestCode=" + requestCode, fallbackError);
                return false;
            }
        } catch (Exception error) {
            Log.e(TAG, "Failed to schedule alarm requestCode=" + requestCode, error);
            return false;
        }
    }

    private static void cancelAlarm(Context context, AlarmManager alarmManager, int requestCode) {
        Intent reminderIntent = new Intent(context, ReminderReceiver.class);
        reminderIntent.setAction(ACTION_REMINDER + "." + requestCode);

        PendingIntent operation = PendingIntent.getBroadcast(
            context,
            requestCode,
            reminderIntent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );

        if (operation != null) {
            alarmManager.cancel(operation);
            operation.cancel();
        }
    }

    private static AlarmManager getAlarmManager(Context context) {
        return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    }

    private static boolean canScheduleExactAlarms(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }

        AlarmManager alarmManager = getAlarmManager(context);
        return alarmManager != null && alarmManager.canScheduleExactAlarms();
    }

    private static SharedPreferences getPreferences(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static JSONObject loadStoredOccurrences(Context context) {
        String raw = getPreferences(context).getString(KEY_STORED_OCCURRENCES, "{}");
        try {
            return new JSONObject(raw == null ? "{}" : raw);
        } catch (JSONException error) {
            Log.w(TAG, "Stored occurrence payload is invalid. Resetting.", error);
            return new JSONObject();
        }
    }

    private static void saveStoredOccurrences(Context context, JSONObject store) {
        getPreferences(context).edit().putString(KEY_STORED_OCCURRENCES, store.toString()).apply();
    }
}
