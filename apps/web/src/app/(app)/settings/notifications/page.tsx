"use client";

import { useState } from "react";
import { Bell, MessageCircle, Send, Mail, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useNotificationChannels,
  useConnectDiscord,
  useToggleEmail,
  useRequestTelegramLink,
  useSendTestNotification,
} from "@/lib/api/hooks/use-notifications";
import { useWebPushSubscribe } from "@/lib/hooks/use-webpush";

export default function NotificationSettingsPage() {
  const { data: channels } = useNotificationChannels();
  const connectDiscord = useConnectDiscord();
  const toggleEmail = useToggleEmail();
  const requestTelegramLink = useRequestTelegramLink();
  const sendTest = useSendTestNotification();
  const { subscribe, isSubscribing } = useWebPushSubscribe();

  const [discordUrl, setDiscordUrl] = useState("");
  const [telegramLink, setTelegramLink] = useState<string | null>(null);

  const emailChannel = channels?.find((c) => c.type === "EMAIL");
  const webpushChannel = channels?.find((c) => c.type === "WEBPUSH");
  const telegramChannel = channels?.find((c) => c.type === "TELEGRAM");
  const discordChannel = channels?.find((c) => c.type === "DISCORD");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-brand" /> Browser Push
          </CardTitle>
          <CardDescription>Get notified even when LevelPulse isn&apos;t open in a tab.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          {webpushChannel?.isEnabled ? (
            <Badge variant="positive">
              <Check className="size-3" /> Enabled
            </Badge>
          ) : (
            <Button size="sm" variant="glass" onClick={subscribe} disabled={isSubscribing}>
              {isSubscribing ? "Enabling..." : "Enable"}
            </Button>
          )}
          {webpushChannel?.isEnabled && (
            <Button size="sm" variant="ghost" onClick={() => sendTest.mutate("WEBPUSH")}>
              Send test
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-brand" /> Email
          </CardTitle>
          <CardDescription>Sent to your account email.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Switch checked={emailChannel?.isEnabled ?? false} onCheckedChange={(v) => toggleEmail.mutate(v)} />
          {emailChannel?.isEnabled && (
            <Button size="sm" variant="ghost" onClick={() => sendTest.mutate("EMAIL")}>
              Send test
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="size-4 text-brand" /> Telegram
          </CardTitle>
          <CardDescription>Connect a bot chat to get pinged on Telegram.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {telegramChannel?.isEnabled ? (
            <div className="flex items-center justify-between">
              <Badge variant="positive">
                <Check className="size-3" /> Connected
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => sendTest.mutate("TELEGRAM")}>
                Send test
              </Button>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                variant="glass"
                className="self-start"
                onClick={async () => {
                  const result = await requestTelegramLink.mutateAsync();
                  setTelegramLink(result.deepLink);
                }}
              >
                Generate link
              </Button>
              {telegramLink && (
                <a href={telegramLink} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline break-all">
                  {telegramLink}
                </a>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="size-4 text-brand" /> Discord
          </CardTitle>
          <CardDescription>Paste a webhook URL from your Discord server settings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {discordChannel?.isEnabled ? (
            <div className="flex items-center justify-between">
              <Badge variant="positive">
                <Check className="size-3" /> Connected
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => sendTest.mutate("DISCORD")}>
                Send test
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
              <Button
                onClick={() => connectDiscord.mutate(discordUrl, { onSuccess: () => setDiscordUrl("") })}
                disabled={connectDiscord.isPending || !discordUrl}
              >
                Connect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
