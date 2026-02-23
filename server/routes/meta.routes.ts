/**
 * 메타/마스터 데이터 & 주소 검색 API 라우트
 *
 * - GET /api/meta/couriers                          – 택배사 목록
 * - GET /api/meta/category-pricing                  – 카테고리별 단가
 * - GET /api/meta/contract-settings                 – 계약 설정
 * - GET /api/meta/couriers/:courierName/rate-items  – 택배사별 단가 항목
 * - GET /api/meta/couriers/:courierName/tiered-pricing – 택배사별 구간 단가
 * - GET /api/meta/vehicle-types                     – 차량 유형 목록
 * - GET /api/meta/order-categories                  – 오더 카테고리 목록
 * - GET /api/address/search                         – 주소 검색 (Kakao API)
 */

import type { RouteContext } from "./types";

export function registerMetaRoutes(ctx: RouteContext): void {
  const { app, storage } = ctx;

  // ============================================
  // Meta API
  // ============================================

  app.get("/api/meta/couriers", async (req, res) => {
    try {
      const settings = await storage.getAllCourierSettings();
      const courierList = settings
        .filter((s: any) => s.isActive)
        .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);

      const result = courierList.map((s: any) => ({
        id: s.id,
        code: s.id.toString(),
        name: s.courierName,
        label: s.courierName,
        category: s.category || "parcel",
        basePricePerBox: s.basePricePerBox || 0,
        etcPricePerBox: s.etcPricePerBox || 0,
        minDeliveryFee: s.minDeliveryFee || 0,
        minTotal: s.minTotal || 0,
        commissionRate: s.commissionRate || 0,
        urgentCommissionRate: s.urgentCommissionRate || 0,
        urgentSurchargeRate: s.urgentSurchargeRate || 0,
        isDefault: s.isDefault || false,
        sortOrder: s.sortOrder || 0,
        active: true,
      }));
      res.json(result);
    } catch (err: any) {
      console.error("Error fetching couriers:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meta/category-pricing", async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      const settingsMap: Record<string, string> = {};
      settings.forEach((s: any) => {
        settingsMap[s.settingKey] = s.settingValue;
      });

      res.json({
        other: {
          destinationPrice: parseInt(settingsMap["other_destination_price"]) || 1800,
          boxPrice: parseInt(settingsMap["other_box_price"]) || 1500,
          minDailyFee: parseInt(settingsMap["other_min_daily_fee"]) || 50000,
          commissionRate: parseInt(settingsMap["other_commission_rate"]) || 10,
          urgentCommissionRate: parseInt(settingsMap["other_urgent_commission_rate"]) || 12,
        },
        cold: {
          minDailyFee: parseInt(settingsMap["cold_min_daily_fee"]) || 100000,
          commissionRate: parseInt(settingsMap["cold_commission_rate"]) || 10,
          urgentCommissionRate: parseInt(settingsMap["cold_urgent_commission_rate"]) || 12,
        },
      });
    } catch (err: any) {
      console.error("Error fetching category pricing:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meta/contract-settings", async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      const settingsMap: Record<string, string> = {};
      settings.forEach((s: any) => {
        settingsMap[s.settingKey] = s.settingValue;
      });

      res.json({
        depositRate: parseInt(settingsMap["deposit_rate"]) || 10,
      });
    } catch (err: any) {
      console.error("Error fetching contract settings:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meta/couriers/:courierName/rate-items", async (req, res) => {
    try {
      const couriers = await storage.getAllCourierSettings();
      const courier = couriers.find((c: any) => c.courierName === decodeURIComponent(req.params.courierName));

      if (!courier) {
        return res.json([
          { id: 0, itemName: "\uBC30\uC1A1", itemType: "delivery", unitPrice: 0, includeVat: false, displayOrder: 0 },
          { id: 0, itemName: "\uBC18\uD488", itemType: "return", unitPrice: 0, includeVat: false, displayOrder: 1 },
          { id: 0, itemName: "\uC218\uAC70", itemType: "pickup", unitPrice: 0, includeVat: false, displayOrder: 2 },
        ]);
      }

      const rateItems = await storage.getCarrierRateItemsByCourier(courier.id);

      if (rateItems.length === 0) {
        return res.json([
          { id: 0, itemName: "\uBC30\uC1A1", itemType: "delivery", unitPrice: 0, includeVat: false, displayOrder: 0 },
          { id: 0, itemName: "\uBC18\uD488", itemType: "return", unitPrice: 0, includeVat: false, displayOrder: 1 },
          { id: 0, itemName: "\uC218\uAC70", itemType: "pickup", unitPrice: 0, includeVat: false, displayOrder: 2 },
        ]);
      }

      res.json(rateItems);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meta/couriers/:courierName/tiered-pricing", async (req, res) => {
    try {
      const couriers = await storage.getAllCourierSettings();
      const courier = couriers.find((c: any) => c.courierName === decodeURIComponent(req.params.courierName));

      if (!courier) {
        return res.json([]);
      }

      const tieredPricing = await storage.getCourierTieredPricingByCourier(courier.id);
      const sortedPricing = tieredPricing
        .filter((tp: any) => tp.isActive)
        .sort((a: any, b: any) => a.minBoxCount - b.minBoxCount);

      res.json(sortedPricing);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meta/vehicle-types", async (req, res) => {
    try {
      const settings = await storage.getAllVehicleTypeSettings();
      const result = settings
        .filter((s: any) => s.isActive !== false)
        .map((s: any) => ({
          id: s.id,
          label: s.vehicleTypeName,
          isDefault: s.isDefault || false,
          sortOrder: s.sortOrder,
          active: s.isActive !== false,
        }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meta/order-categories", async (req, res) => {
    try {
      const settings = await storage.getAllOrderCategorySettings();
      const result = settings
        .filter((s: any) => s.isActive !== false)
        .map((s: any) => ({
          id: s.id,
          label: s.categoryName,
          sortOrder: s.sortOrder,
          isAdminOnly: s.isAdminOnly || false,
          allowedCourierNames: s.allowedCourierNames ? JSON.parse(s.allowedCourierNames) : null,
          active: s.isActive !== false,
        }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Address Search API (Kakao Local API)
  // ============================================
  app.get("/api/address/search", async (req, res) => {
    try {
      const query = req.query.query as string;
      if (!query || query.length < 2) {
        return res.status(400).json({ message: "\uAC80\uC0C9\uC5B4\uB97C 2\uAE00\uC790 \uC774\uC0C1 \uC785\uB825\uD574\uC8FC\uC138\uC694" });
      }

      const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

      if (!KAKAO_REST_API_KEY) {
        console.log("KAKAO_REST_API_KEY not set, using fallback mode");
        return res.json({
          results: [
            {
              address: query,
              roadAddress: query,
              jibunAddress: "",
              buildingName: "",
            },
          ],
        });
      }

      console.log("[Address Search] Querying Kakao API for:", query);

      const response = await fetch(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=10`,
        {
          headers: {
            Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Address Search] Address API failed:", response.status, errorText);

        const keywordResponse = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`,
          {
            headers: {
              Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
            },
          }
        );

        if (!keywordResponse.ok) {
          const keywordErrorText = await keywordResponse.text();
          console.error("[Address Search] Keyword API also failed:", keywordResponse.status, keywordErrorText);

          return res.json({
            results: [
              {
                address: query,
                roadAddress: query,
                jibunAddress: "",
                buildingName: "",
              },
            ],
          });
        }

        const keywordData: any = await keywordResponse.json();
        const results =
          keywordData.documents?.map((doc: any) => ({
            address: doc.address_name || "",
            roadAddress: doc.road_address_name || doc.address_name || "",
            jibunAddress: doc.address_name || "",
            buildingName: doc.place_name || "",
          })) || [];

        return res.json({ results });
      }

      const data: any = await response.json();
      const results =
        data.documents?.map((doc: any) => ({
          address: doc.address?.address_name || doc.address_name || "",
          roadAddress: doc.road_address?.address_name || doc.address?.address_name || "",
          jibunAddress: doc.address?.address_name || "",
          buildingName: doc.road_address?.building_name || "",
        })) || [];

      // Fallback to keyword search if no results
      if (results.length === 0) {
        const keywordResponse = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`,
          {
            headers: {
              Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
            },
          }
        );

        if (keywordResponse.ok) {
          const keywordData: any = await keywordResponse.json();
          const keywordResults =
            keywordData.documents?.map((doc: any) => ({
              address: doc.address_name || "",
              roadAddress: doc.road_address_name || doc.address_name || "",
              jibunAddress: doc.address_name || "",
              buildingName: doc.place_name || "",
            })) || [];

          return res.json({ results: keywordResults });
        }
      }

      res.json({ results });
    } catch (err: any) {
      console.error("Address search error:", err);
      res.status(500).json({ message: "\uC8FC\uC18C \uAC80\uC0C9 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4" });
    }
  });
}
