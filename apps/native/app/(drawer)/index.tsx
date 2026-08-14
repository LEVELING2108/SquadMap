import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Button, Chip, Separator, Spinner, Surface, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignOutButton } from "@/components/sign-out-button";
import { trpc } from "@/utils/trpc";

export default function Home() {
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");

  const isConnected = healthCheck?.data === "OK";
  const isLoading = healthCheck?.isLoading;

  return (
    <Container className="px-4 pb-4">
      <View className="py-6 mb-3">
        <View className="flex-row items-center gap-2 mb-1">
          <Ionicons name="compass-outline" size={28} color="#059669" />
          <Text className="text-3xl font-bold text-foreground tracking-tight">
            SquadMap
          </Text>
        </View>
        <Text className="text-muted text-sm font-medium">
          Track your squad on one shared map • No Sign-up Required
        </Text>
      </View>

      <Surface variant="secondary" className="p-4 rounded-2xl mb-4 border border-border">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-foreground font-semibold">Live System Status</Text>
          <Chip variant="secondary" color={isConnected ? "success" : "danger"} size="sm">
            <Chip.Label>{isConnected ? "ONLINE" : "OFFLINE"}</Chip.Label>
          </Chip>
        </View>

        <Separator className="mb-3" />

        <Surface variant="tertiary" className="p-3 rounded-xl">
          <View className="flex-row items-center">
            <View
              className={`w-2.5 h-2.5 rounded-full mr-3 ${isConnected ? "bg-success" : "bg-muted"}`}
            />
            <View className="flex-1">
              <Text className="text-foreground text-sm font-medium">tRPC API Backend</Text>
              <Text className="text-muted text-xs mt-0.5">
                {isLoading
                  ? "Connecting..."
                  : isConnected
                    ? "Connected to SquadMap API"
                    : "API Disconnected"}
              </Text>
            </View>
            {isLoading && <Spinner size="sm" />}
            {!isLoading && isConnected && (
              <Ionicons name="checkmark-circle" size={20} color={successColor} />
            )}
            {!isLoading && !isConnected && (
              <Ionicons name="close-circle" size={20} color={dangerColor} />
            )}
          </View>
        </Surface>
      </Surface>

      <View className="gap-3">
        <Button variant="primary">
          <Button.Label>Start a Trip Room</Button.Label>
        </Button>
        <Button variant="secondary">
          <Button.Label>Join Room Code</Button.Label>
        </Button>
      </View>
    </Container>
  );
}

