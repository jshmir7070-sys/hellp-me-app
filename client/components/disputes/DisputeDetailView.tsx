import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Modal, Pressable, Image, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { DISPUTE_TYPE_LABELS, DISPUTE_STATUS_CONFIG } from "@/constants/dispute";

const { width: screenWidth } = Dimensions.get("window");

interface DisputeDetailViewProps {
    dispute: {
        id: number;
        disputeType: string;
        status: string;
        workDate: string;
        createdAt: string;
        description: string;
        adminReply?: string | null;
        adminUserName?: string | null;
        adminReplyAt?: string | null;
        resolution?: string | null;
        resolvedAt?: string | null;
        evidencePhotoUrls?: string[];
        courierName?: string | null;
        order?: {
            id: number;
            courierCompany: string;
        } | null;
        trackingNumber?: string | null;
        [key: string]: any;
    };
    children?: React.ReactNode; // Custom content inside description card
    footerContent?: React.ReactNode; // Content after description card
    hideAdminReply?: boolean;
    hideResolution?: boolean;
    statusLabels?: Record<string, { label: string; color: string; bg: string }>;
}

export function DisputeDetailView({
    dispute,
    children,
    footerContent,
    hideAdminReply = false,
    hideResolution = false,
    statusLabels = DISPUTE_STATUS_CONFIG
}: DisputeDetailViewProps) {
    const insets = useSafeAreaInsets();
    const headerHeight = useHeaderHeight();
    const { theme } = useTheme();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const statusConfig = statusLabels[dispute.status] || statusLabels.pending;

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    };

    return (
        <>
            <ScrollView
                style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
                contentContainerStyle={{
                    paddingTop: headerHeight + Spacing.md,
                    paddingBottom: insets.bottom + Spacing.xl,
                    paddingHorizontal: Spacing.md,
                }}
            >
                <Card style={styles.card}>
                    <View style={styles.headerRow}>
                        <View style={styles.typeContainer}>
                            <Icon
                                name={["freight_accident", "damage"].includes(dispute.disputeType) ? "warning-outline" : "document-text-outline"}
                                size={20}
                                color={BrandColors.helper}
                            />
                            <ThemedText style={[styles.typeText, { color: theme.text }]}>
                                {DISPUTE_TYPE_LABELS[dispute.disputeType] || dispute.disputeType}
                            </ThemedText>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                            <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                                {statusConfig.label}
                            </ThemedText>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoSection}>
                        <View style={styles.infoRow}>
                            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>작업일/근무일</ThemedText>
                            <ThemedText style={[styles.value, { color: theme.text }]}>{formatDate(dispute.workDate)}</ThemedText>
                        </View>
                        <View style={styles.infoRow}>
                            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>접수일시</ThemedText>
                            <ThemedText style={[styles.value, { color: theme.text }]}>{formatDate(dispute.createdAt)}</ThemedText>
                        </View>
                        {dispute.courierName ? (
                            <View style={styles.infoRow}>
                                <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>택배사</ThemedText>
                                <ThemedText style={[styles.value, { color: theme.text }]}>{dispute.courierName}</ThemedText>
                            </View>
                        ) : null}
                        {dispute.order ? (
                            <View style={styles.infoRow}>
                                <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>오더정보</ThemedText>
                                <ThemedText style={[styles.value, { color: theme.text }]}>
                                    #{dispute.order.id} {dispute.order.courierCompany}
                                </ThemedText>
                            </View>
                        ) : null}
                        {dispute.trackingNumber ? (
                            <View style={styles.infoRow}>
                                <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>운송장번호</ThemedText>
                                <ThemedText style={[styles.value, { color: theme.text }]}>{dispute.trackingNumber}</ThemedText>
                            </View>
                        ) : null}
                    </View>
                </Card>

                <Card style={styles.card}>
                    <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>내용</ThemedText>
                    <ThemedText style={[styles.description, { color: theme.text }]}>{dispute.description}</ThemedText>

                    {/* Custom Content (Amounts, Counts) */}
                    {children}

                    {dispute.evidencePhotoUrls && dispute.evidencePhotoUrls.length > 0 ? (
                        <View style={styles.photoSection}>
                            <ThemedText style={[styles.photoLabel, { color: theme.tabIconDefault }]}>증빙 사진</ThemedText>
                            <View style={styles.photoGrid}>
                                {dispute.evidencePhotoUrls.map((url, index) => (
                                    <Pressable key={index} onPress={() => setSelectedImage(url)}>
                                        <Image source={{ uri: url }} style={styles.photoThumbnail} />
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    ) : null}
                </Card>

                {footerContent}

                {!hideAdminReply && dispute.adminReply ? (
                    <Card style={[styles.card, styles.replyCard] as any}>
                        <View style={styles.replyHeader}>
                            <Icon name="chatbox-outline" size={18} color={BrandColors.helper} />
                            <ThemedText style={[styles.sectionTitle, { color: theme.text, marginLeft: Spacing.xs }]}>관리자 답변</ThemedText>
                        </View>
                        <ThemedText style={[styles.replyText, { color: theme.text }]}>{dispute.adminReply}</ThemedText>
                        <View style={styles.replyMeta}>
                            {dispute.adminUserName ? (
                                <ThemedText style={[styles.metaText, { color: theme.tabIconDefault }]}>
                                    답변자: {dispute.adminUserName}
                                </ThemedText>
                            ) : null}
                            {dispute.adminReplyAt ? (
                                <ThemedText style={[styles.metaText, { color: theme.tabIconDefault }]}>
                                    {formatDate(dispute.adminReplyAt)}
                                </ThemedText>
                            ) : null}
                        </View>
                    </Card>
                ) : null}

                {!hideResolution && (dispute.resolution || dispute.status === 'resolved') ? (
                    <Card style={[styles.card, styles.resolutionCard] as any}>
                        <View style={styles.replyHeader}>
                            <Icon name="checkmark-circle-outline" size={18} color="#10B981" />
                            <ThemedText style={[styles.sectionTitle, { color: theme.text, marginLeft: Spacing.xs }]}>처리결과</ThemedText>
                        </View>
                        {dispute.resolution ? (
                            <ThemedText style={[styles.replyText, { color: theme.text }]}>{dispute.resolution}</ThemedText>
                        ) : null}
                        {dispute.resolvedNote ? (
                            <ThemedText style={[styles.replyText, { color: theme.text }]}>{dispute.resolvedNote}</ThemedText>
                        ) : null}
                        {dispute.resolvedAt ? (
                            <ThemedText style={[styles.metaText, { color: theme.tabIconDefault, marginTop: Spacing.sm }]}>
                                처리일시: {formatDate(dispute.resolvedAt)}
                            </ThemedText>
                        ) : null}
                    </Card>
                ) : null}
            </ScrollView>

            <Modal
                visible={!!selectedImage}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedImage(null)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setSelectedImage(null)}>
                    <View style={styles.modalContent}>
                        {selectedImage ? (
                            <Image
                                source={{ uri: selectedImage }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                        ) : null}
                        <Pressable style={styles.closeButton} onPress={() => setSelectedImage(null)}>
                            <Icon name="close" size={28} color="#fff" />
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    typeContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
    },
    typeText: {
        fontSize: 18,
        fontWeight: "700",
    },
    statusBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: BorderRadius.md,
    },
    statusText: {
        fontSize: 14,
        fontWeight: "600",
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(0,0,0,0.08)",
        marginVertical: Spacing.md,
    },
    infoSection: {
        gap: Spacing.sm,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    label: {
        fontSize: 14,
    },
    value: {
        fontSize: 14,
        fontWeight: "500",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: Spacing.sm,
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
    },
    replyCard: {
        borderLeftWidth: 3,
        borderLeftColor: BrandColors.helper,
    },
    replyHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: Spacing.sm,
    },
    replyText: {
        fontSize: 15,
        lineHeight: 22,
    },
    replyMeta: {
        marginTop: Spacing.sm,
        gap: 2,
    },
    metaText: {
        fontSize: 12,
    },
    resolutionCard: {
        borderLeftWidth: 3,
        borderLeftColor: "#10B981",
    },
    photoSection: {
        marginTop: Spacing.md,
    },
    photoLabel: {
        fontSize: 13,
        marginBottom: Spacing.sm,
    },
    photoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.sm,
    },
    photoThumbnail: {
        width: 72,
        height: 72,
        borderRadius: BorderRadius.sm,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        width: screenWidth,
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    fullImage: {
        width: screenWidth - 40,
        height: screenWidth - 40,
    },
    closeButton: {
        position: "absolute",
        top: 50,
        right: 20,
        padding: 10,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        borderRadius: 20,
    },
});
