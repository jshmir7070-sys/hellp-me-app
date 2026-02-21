/**
 * 리뷰(Review) API 라우트
 *
 * - POST /api/reviews                    – 리뷰 작성 (의뢰인→헬퍼)
 * - GET  /api/reviews/helper/:helperId   – 헬퍼 리뷰 목록 및 평균 평점
 * - GET  /api/reviews/my                 – 내가 작성한 리뷰 목록
 * - GET  /api/orders/review-pending      – 리뷰 대기 오더 목록
 */

import type { RouteContext } from "./types";

export function registerReviewRoutes(ctx: RouteContext): void {
  const { app, requireAuth, storage } = ctx;

  // 리뷰 작성 (의뢰인→헬퍼)
  app.post("/api/reviews", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;

      const { contractId, orderId, helperId, rating, comment } = req.body;

      // Check for requester->helper review specifically
      const existingReview = await storage.getReviewByContractAndType(contractId, "requester");
      if (existingReview) {
        return res.status(400).json({ message: "이미 리뷰를 작성했습니다" });
      }

      // helperId가 없으면 오더에서 조회
      let resolvedHelperId = helperId;
      if (!resolvedHelperId && orderId) {
        const order = await storage.getOrder(Number(orderId));
        resolvedHelperId = (order as any)?.selectedHelperId || (order as any)?.matchedHelperId || null;
      }

      const review = await storage.createReview({
        contractId,
        orderId,
        requesterId: userId,
        helperId: resolvedHelperId,
        reviewerType: "requester",
        rating,
        comment,
      });

      // 헬퍼 평점 요약 업데이트
      if (resolvedHelperId) {
        try {
          const helperReviews = await storage.getHelperReviews(resolvedHelperId);
          const totalRating = helperReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
          const avgRating = helperReviews.length > 0 ? Math.round((totalRating / helperReviews.length) * 100) : 0;
          await storage.upsertHelperRatingSummary({
            helperUserId: resolvedHelperId,
            avgRating,
            reviewCount: helperReviews.length,
          });
        } catch (summaryErr) {
          console.error("Failed to update helper rating summary:", summaryErr);
        }
      }

      res.status(201).json(review);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼 리뷰 목록 및 평균 평점
  app.get("/api/reviews/helper/:helperId", async (req, res) => {
    try {
      const reviews = await storage.getHelperReviews(req.params.helperId);
      const avgRating = await storage.getHelperAverageRating(req.params.helperId);
      res.json({ reviews, averageRating: avgRating });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 내가 작성한 리뷰 목록
  app.get("/api/reviews/my", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;

      // Get reviews written by this user
      const allReviews = await storage.getReviewsByReviewer(userId);

      // Enhance with order info
      const reviewsWithDetails = await Promise.all(allReviews.map(async (review: any) => {
        const order = await storage.getOrder(review.orderId);
        const helper = await storage.getUser(review.helperId);
        return {
          id: review.id,
          orderId: review.orderId,
          helperName: helper?.name || "Unknown",
          helperNickname: (helper as any)?.nickname || null,
          rating: review.rating,
          comment: review.comment,
          courierCompany: order?.companyName || "",
          workDate: order?.scheduledDate || "",
          createdAt: review.createdAt,
        };
      }));

      res.json(reviewsWithDetails);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 리뷰 대기 오더 목록 (의뢰인)
  app.get("/api/orders/review-pending", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      // Get requester's completed orders (balance_paid, settlement_paid, closed)
      const orders = await storage.getOrdersByRequesterId(userId);
      const completedOrders = orders.filter((o: any) =>
        o.status === "balance_paid" || o.status === "settlement_paid" || o.status === "closed"
      );

      const pendingOrders: any[] = [];
      for (const order of completedOrders) {
        // Get contracts for this order
        const contracts = await storage.getOrderContracts(order.id);

        for (const contract of contracts) {
          if (contract.status === "completed") {
            // Check if review exists for this contract
            const existingReview = await storage.getReviewByContract(contract.id);
            if (!existingReview) {
              const helper = await storage.getUser(contract.helperId);
              pendingOrders.push({
                id: order.id,
                contractId: contract.id,
                courierCompany: order.companyName,
                workDate: order.scheduledDate,
                helperName: helper?.name || "Unknown",
                helperNickname: (helper as any)?.nickname || null,
              });
            }
          }
        }
      }

      res.json(pendingOrders);
    } catch (err: any) {
      console.error("Review pending orders error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
