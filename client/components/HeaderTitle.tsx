import React from "react";
import { View, StyleSheet, Image } from "react-native";

interface HeaderTitleProps {
  size?: "large" | "small";
}

export function HeaderTitle({ size = "small" }: HeaderTitleProps) {
  const logoStyle = size === "large" ? styles.logoLarge : styles.logoSmall;
  
  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/hellpme-logo.png")}
        style={logoStyle}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  logoLarge: {
    width: 200,
    height: 70,
  },
  logoSmall: {
    width: 120,
    height: 40,
  },
});
