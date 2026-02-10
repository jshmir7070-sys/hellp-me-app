import React from "react";
import { View, StyleSheet } from "react-native";
import { TossLogo } from "./TossLogo";

interface HeaderTitleProps {
  size?: "large" | "small";
  gradient?: boolean;
}

export function HeaderTitle({ size = "small", gradient = false }: HeaderTitleProps) {
  return (
    <View style={styles.container}>
      <TossLogo size={size} gradient={gradient} />
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
