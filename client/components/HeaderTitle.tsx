import React from "react";
import { View, StyleSheet } from "react-native";
import { TossLogo } from "./TossLogo";

interface HeaderTitleProps {
  size?: "large" | "small";
}

export function HeaderTitle({ size = "small" }: HeaderTitleProps) {
  return (
    <View style={styles.container}>
      <TossLogo size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
});
