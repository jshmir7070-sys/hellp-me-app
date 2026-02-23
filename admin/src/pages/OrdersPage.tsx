import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiRequest, adminFetch } from '@/lib/api';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { downloadCSV } from '@/utils/csv-export';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Money,
  EntityLink,
  DateRangePicker,
  getDefaultDateRange,
  DrawerDetail,
  ReasonModal,
  HelperDetailModal,
  Pagination,
} from '@/components/common';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { CheckCircle, RefreshCw, Download, Filter, ChevronDown, UserPlus, Banknote, XCircle, Users, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS, normalizeOrderStatus, getOrderActionState } from '@/constants/orderStatus';

interface Courier {
  code: string;
  name: string;
  category: string;
  basePricePerBox: number;
}

interface OrderApplication {
  id: number;
  orderId: number;
  helperId: string;
  status: string;
  message?: string;
  expectedArrival?: string;
  appliedAt: string;
  helperName?: string;
  helperPhone?: string;
}

interface Order {
  id: number;
  createdAt: string;
  requesterId: number;
  requesterName: string;
  requesterPhone?: string;
  requesterEmail?: string;
  deliveryArea: string;
  campAddress: string;
  courierCompany: string;
  courierCategory?: string;
  companyName: string;
  boxCount: number;
  unitPrice: number;
  totalAmount: number;
  status: string;
  matchedHelperId?: number;
  helperName?: string;
  helperTeamName?: string;
  helperProfileImage?: string;
  helperPhone?: string;
  deadline?: string;
  requestedDate?: string;
  scheduledDate?: string;
  paymentStatus?: string;
  settlementStatus?: string;
  averageQuantity?: number;
  contactPhone?: string;
  deliveryGuide?: string;
  depositAmount?: number;
  paidAt?: string;
  balancePaymentDueDate?: string;
  regionMapUrl?: string;
  contractConfirmed?: boolean;
  contractConfirmedAt?: string;
  signatureData?: string;
  maxHelpers?: number;
  currentHelpers?: number;
  enterpriseId?: number | null;
  orderNumber?: string | null;
}

// 12자리 오더번호 포맷 (1-002-1234-0001)
function formatOrderNumber(orderNumber: string | null | undefined, orderId: number): string {
  if (orderNumber) {
    if (orderNumber.length === 12) {
      return `${orderNumber.slice(0, 1)}-${orderNumber.slice(1, 4)}-${orderNumber.slice(4, 8)}-${orderNumber.slice(8, 12)}`;
    }
    return orderNumber;
  }
  return `#${orderId}`;
}

function getCourierCategory(courierCompany: string): 'parcel' | 'other' | 'cold' {
  const coldKeywords = ['냉동', '냉탑', 'cold', '전문냉동', 'CU냉동', 'GS냉동', '세븐일레븐냉동', '이마트냉동', '롯데마트냉동', '홈플러스냉동', '코스트코냉동'];
  const otherKeywords = ['기타', '수기입력', 'other'];
  
  const lowerName = courierCompany.toLowerCase();
  
  if (coldKeywords.some(k => lowerName.includes(k.toLowerCase()))) return 'cold';
  if (otherKeywords.some(k => lowerName.includes(k.toLowerCase()))) return 'other';
  return 'parcel';
}


export default function OrdersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateRange, setDateRange] = useState(getDefaultDateRange(7));
  const [activeView, setActiveView] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'parcel' | 'other' | 'cold'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [filterOpen, setFilterOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('summary');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isApproveClosingModalOpen, setIsApproveClosingModalOpen] = useState(false);
  const [isConfirmBalanceModalOpen, setIsConfirmBalanceModalOpen] = useState(false);
  const [selectedHelperId, setSelectedHelperId] = useState<string | null>(null);
  const [selectedHelperIds, setSelectedHelperIds] = useState<Set<string>>(new Set());
  const [helperSearchQuery, setHelperSearchQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [helperDetailId, _setHelperDetailId] = useState<string | number | null>(null);
  const [isHelperDetailOpen, setIsHelperDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isEditingDeposit, setIsEditingDeposit] = useState(false);
  const [editDepositAmount, setEditDepositAmount] = useState('');
  const [orderCategoryTab, setOrderCategoryTab] = useState<'택배사' | '기타택배' | '냉탑전용'>('택배사');
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  const [newOrderForm, setNewOrderForm] = useState({
    companyName: '',
    carrierCode: '',
    courierCompany: '',
    courierCategory: 'parcel' as 'parcel' | 'other' | 'cold',
    deliveryArea: '',
    campAddress: '',
    averageQuantity: '',
    pricePerUnit: 0,
    scheduledDate: '',
    scheduledDateEnd: '',
    vehicleType: '1톤',
    contactPhone: '',
    requesterPhone: '',
    deliveryGuide: '',
    memo: '',
    isUrgent: false,
    // 기타택배 전용
    unitPriceManual: '',
    regionLarge: '',
    regionMedium: '',
    regionSmall: '',
    priceType: 'perBox' as 'perBox' | 'perDestination',
    // 냉탑전용
    freight: '',
    waypoints: [''],
    coldCompanyName: '',
    // 협력업체
    enterpriseId: null as number | null,
    enterpriseName: '',
    settlementDate: '',
  });

  // 협력업체 검색
  const [enterpriseSearch, setEnterpriseSearch] = useState('');
  const [showEnterpriseDropdown, setShowEnterpriseDropdown] = useState(false);

  const { data: enterpriseSearchResults = [] } = useQuery<any[]>({
    queryKey: ['enterprise-search', enterpriseSearch],
    enabled: enterpriseSearch.length >= 1,
    queryFn: async () => {
      try {
        const data = await apiRequest<any[]>(`/enterprise-accounts/search?q=${encodeURIComponent(enterpriseSearch)}`);
        return data || [];
      } catch { return []; }
    },
  });

  const { data: ordersResponse, isLoading, refetch } = useQuery({
    queryKey: ['admin-orders', dateRange, currentPage, itemsPerPage, debouncedSearch],
    refetchInterval: autoRefresh ? 10000 : false, // 자동 새로고침 시 10초마다
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append('page', String(currentPage));
        params.append('limit', String(itemsPerPage));
        if (debouncedSearch) params.append('search', debouncedSearch);
        
        const data = await apiRequest<{ 
          data: any[]; 
          pagination: { page: number; limit: number; total: number; totalPages: number } 
        }>(`/orders?${params.toString()}`);
        
        return {
          orders: data.data.map((o: any) => ({
            id: o.id,
            createdAt: o.createdAt,
            requesterId: o.requesterId || 0,
            requesterName: o.requesterName || `요청자${o.requesterId || 0}`,
            requesterPhone: o.requesterPhone,
            requesterEmail: o.requesterEmail || '',
            deliveryArea: o.deliveryArea || '',
            campAddress: o.campAddress || '',
            courierCompany: o.courierCompany || '',
            courierCategory: o.courierCategory || getCourierCategory(o.courierCompany || ''),
            companyName: o.companyName || '',
            boxCount: o.boxCount || 0,
            unitPrice: o.pricePerUnit || o.unitPrice || o.pricePerBox || 0,
            totalAmount: o.totalAmount || 0,
            status: o.status || 'open',
            matchedHelperId: o.matchedHelperId,
            helperName: o.helperName,
            deadline: o.deadline || o.workDate,
            requestedDate: o.requestedDate || o.workDate || o.deadline || o.scheduledDate,
            scheduledDate: o.scheduledDate,
            paymentStatus: o.paymentStatus,
            settlementStatus: o.settlementStatus,
            maxHelpers: o.maxHelpers || 3,
            currentHelpers: o.currentHelpers || 0,
            orderNumber: o.orderNumber || null,
          })),
          pagination: data.pagination,
        };
      } catch {
        return { orders: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
      }
    },
  });

  const orders = ordersResponse?.orders || [];
  const pagination = ordersResponse?.pagination;

  // URL ?id= 파라미터로 오더 상세 자동 오픈
  const autoOpenHandled = useRef(false);
  useEffect(() => {
    if (autoOpenHandled.current) return;
    const targetId = searchParams.get('id');
    if (!targetId || !orders.length) return;

    const orderId = Number(targetId);
    const found = orders.find((o: Order) => o.id === orderId);
    if (found) {
      setSelectedOrder(found);
      setIsDrawerOpen(true);
      autoOpenHandled.current = true;
      // URL에서 id 파라미터 제거 (뒤로가기 시 재트리거 방지)
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    } else if (!found && orderId > 0) {
      // 목록에 없으면 API로 직접 조회
      apiRequest<any>(`/orders/${orderId}`).then((data) => {
        if (data) {
          const order: Order = {
            id: data.id,
            createdAt: data.createdAt,
            requesterId: data.requesterId || 0,
            requesterName: data.requesterName || `요청자${data.requesterId || 0}`,
            requesterPhone: data.requesterPhone,
            requesterEmail: data.requesterEmail || '',
            deliveryArea: data.deliveryArea || '',
            campAddress: data.campAddress || '',
            courierCompany: data.courierCompany || '',
            courierCategory: data.courierCategory || 'parcel',
            companyName: data.companyName || '',
            boxCount: data.boxCount || 0,
            unitPrice: data.pricePerUnit || data.unitPrice || 0,
            totalAmount: data.totalAmount || 0,
            status: data.status || 'open',
            matchedHelperId: data.matchedHelperId,
            helperName: data.helperName,
            deadline: data.deadline || data.workDate,
            requestedDate: data.requestedDate || data.workDate || data.scheduledDate,
            scheduledDate: data.scheduledDate,
            paymentStatus: data.paymentStatus,
            settlementStatus: data.settlementStatus,
            maxHelpers: data.maxHelpers || 3,
            currentHelpers: data.currentHelpers || 0,
            orderNumber: data.orderNumber || null,
          };
          setSelectedOrder(order);
          setIsDrawerOpen(true);
          autoOpenHandled.current = true;
          searchParams.delete('id');
          setSearchParams(searchParams, { replace: true });
        }
      }).catch(() => { /* 오더 조회 실패 시 무시 */ });
      autoOpenHandled.current = true;
    }
  }, [orders, searchParams, setSearchParams]);

  interface Helper {
    id: string;
    name: string;
    phoneNumber?: string;
    dailyStatus?: string;
    teamName?: string;
  }

  const { data: helpers = [] } = useQuery<Helper[]>({
    queryKey: ['admin-helpers'],
    queryFn: async () => {
      try {
        const data = await apiRequest<{ data: any[]; pagination: any }>('/helpers?limit=200');
        return (data.data || []).map((h: any) => ({
          id: h.id,
          name: h.name || '이름없음',
          phoneNumber: h.phoneNumber,
          dailyStatus: h.dailyStatus,
          teamName: h.teamName,
        }));
      } catch {
        return [];
      }
    },
  });

  const { data: couriers = [] } = useQuery<Courier[]>({
    queryKey: ['couriers-list'],
    queryFn: async () => {
      try {
        const data = await apiRequest<any>('/meta/couriers');
        return (data.couriers || []).map((c: any) => ({
          code: c.code,
          name: c.name,
          category: c.category,
          basePricePerBox: c.basePricePerBox || 1200,
        }));
      } catch {
        return [];
      }
    },
  });

  const { data: categoryPricing } = useQuery({
    queryKey: ['category-pricing'],
    queryFn: async () => {
      try {
        return await apiRequest<any>('/meta/category-pricing');
      } catch {
        return { other: { boxPrice: 1500, minDailyFee: 50000 }, cold: { minDailyFee: 100000 } };
      }
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (formData: typeof newOrderForm) => {
      const selectedCourier = couriers.find(c => c.code === formData.carrierCode);
      const courierName = selectedCourier?.name || formData.courierCompany || formData.coldCompanyName;
      const category = selectedCourier?.category || formData.courierCategory;
      
      let defaultPrice = 1200;
      if (category === 'other') {
        defaultPrice = categoryPricing?.other?.boxPrice || 1500;
      } else if (category === 'cold') {
        defaultPrice = categoryPricing?.cold?.minDailyFee || 100000;
      } else if (selectedCourier) {
        defaultPrice = selectedCourier.basePricePerBox || 1200;
      }
      
      return apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          companyName: formData.companyName || courierName || formData.coldCompanyName,
          courierCompany: courierName,
          courierCategory: category,
          pricePerUnit: parseInt(formData.unitPriceManual) || formData.pricePerUnit || defaultPrice,
          enterpriseId: formData.enterpriseId || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setIsCreateOrderModalOpen(false);
      setOrderCategoryTab('택배사');
      setNewOrderForm({
        companyName: '',
        carrierCode: '',
        courierCompany: '',
        courierCategory: 'parcel',
        deliveryArea: '',
        campAddress: '',
        averageQuantity: '',
        pricePerUnit: 0,
        scheduledDate: '',
        scheduledDateEnd: '',
        vehicleType: '1톤',
        contactPhone: '',
        requesterPhone: '',
        deliveryGuide: '',
        memo: '',
        isUrgent: false,
        unitPriceManual: '',
        regionLarge: '',
        regionMedium: '',
        regionSmall: '',
        priceType: 'perBox',
        freight: '',
        waypoints: [''],
        coldCompanyName: '',
        enterpriseId: null,
        enterpriseName: '',
        settlementDate: '',
      });
      setEnterpriseSearch('');
      setShowEnterpriseDropdown(false);
      refetch();
      toast({ title: '본사 계약권 오더가 등록되었습니다.' });
    },
  });

  // 오더 상세 정보 (선택된 오더의 최신 데이터 조회)
  const { data: orderDetail } = useQuery<Order | null>({
    queryKey: ['order-detail', selectedOrder?.id],
    staleTime: 0, // 항상 최신 데이터 조회
    gcTime: 0, // 캐시 비활성화
    queryFn: async () => {
      if (!selectedOrder?.id) return null;
      try {
        const data = await apiRequest<any>(`/orders/${selectedOrder.id}`);
        return {
          id: data.id,
          createdAt: data.createdAt,
          requesterId: data.requesterId || 0,
          requesterName: data.requesterName || `요청자${data.requesterId || 0}`,
          requesterPhone: data.requesterPhone,
          requesterEmail: data.requesterEmail || '',
          deliveryArea: data.deliveryArea || '',
          campAddress: data.campAddress || '',
          courierCompany: data.courierCompany || '',
          courierCategory: data.courierCategory || getCourierCategory(data.courierCompany || ''),
          companyName: data.companyName || '',
          boxCount: data.boxCount || 0,
          unitPrice: data.pricePerUnit || data.unitPrice || data.pricePerBox || 0,
          totalAmount: data.totalAmount || 0,
          status: data.status || 'open',
          matchedHelperId: data.matchedHelperId,
          helperName: data.helperName,
          deadline: data.deadline || data.workDate,
          requestedDate: data.requestedDate || data.workDate || data.deadline || data.scheduledDate,
          scheduledDate: data.scheduledDate,
          paymentStatus: data.paymentStatus,
          settlementStatus: data.settlementStatus,
          averageQuantity: data.averageQuantity,
          contactPhone: data.contactPhone,
          deliveryGuide: data.deliveryGuide,
          depositAmount: data.depositAmount,
          paidAt: data.paidAt || data.virtualAccount?.paidAt,
          balancePaymentDueDate: data.balancePaymentDueDate,
          regionMapUrl: data.regionMapUrl,
          contractConfirmed: data.contractConfirmed,
          contractConfirmedAt: data.contractConfirmedAt,
          signatureData: data.signatureData,
          maxHelpers: data.maxHelpers || 3,
          currentHelpers: data.currentHelpers || 0,
        };
      } catch {
        return null;
      }
    },
    enabled: !!selectedOrder?.id,
  });

  // 상세 화면에서 사용할 오더 정보 (API에서 가져온 최신 데이터 우선)
  const displayOrder = orderDetail || selectedOrder;

  const { data: applications = [] } = useQuery<OrderApplication[]>({
    queryKey: ['order-applications', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return [];
      try {
        const data = await apiRequest<any[]>(`/orders/${selectedOrder.id}/applications`);
        return data.map((a: any) => ({
          id: a.id,
          orderId: a.orderId,
          helperId: a.helperId,
          status: a.status,
          message: a.message,
          expectedArrival: a.expectedArrival,
          appliedAt: a.appliedAt,
          helperName: a.helperName || a.helper?.name,
          helperPhone: a.helperPhone || a.helper?.phoneNumber,
        }));
      } catch {
        return [];
      }
    },
    enabled: !!selectedOrder?.id,
  });

  interface OrderContract {
    id: number;
    orderId: number;
    helperId?: string;
    helperName?: string;
    helperPhone?: string;
    requesterName?: string;
    requesterPhone?: string;
    helperSignature?: string;
    requesterSignature?: string;
    signedAt?: string;
    status: string;
    createdAt: string;
  }

  interface ClosingExtraItem {
    name: string;
    unitPrice: number;
    quantity: number;
  }

  interface ClosingReport {
    id: number;
    orderId: number;
    helperId: number;
    deliveredCount: number;
    returnedCount: number;
    etcCount: number;
    deliveryHistoryImages: string[];
    etcImages: string[];
    extraCostsJson: ClosingExtraItem[] | null;
    memo: string;
    status: string;
    createdAt: string;
  }

  const { data: contracts = [] } = useQuery<OrderContract[]>({
    queryKey: ['order-contracts', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return [];
      try {
        return await apiRequest<OrderContract[]>(`/orders/${selectedOrder.id}/contracts`);
      } catch {
        return [];
      }
    },
    enabled: !!selectedOrder?.id,
  });

  // 계약서 전문 HTML 조회 (admin auth 사용)
  const { data: contractHtml, isLoading: contractHtmlLoading, isError: contractHtmlError } = useQuery<string>({
    queryKey: ['order-contract-html', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) throw new Error('No order selected');
      const response = await adminFetch(`/api/admin/orders/${selectedOrder.id}/contract/pdf`);
      if (!response.ok) throw new Error(`Contract fetch failed: ${response.status}`);
      const html = await response.text();
      if (!html || html.length < 10) throw new Error('Empty contract HTML');
      return html;
    },
    enabled: !!selectedOrder?.id,
    retry: 1,
  });

  const { data: closingReport } = useQuery<ClosingReport | null>({
    queryKey: ['order-closing-report', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return null;
      try {
        return await apiRequest<ClosingReport>(`/orders/${selectedOrder.id}/closing-report`);
      } catch {
        return null;
      }
    },
    enabled: !!selectedOrder?.id,
  });

  const approveDepositMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest(`/orders/${orderId}/approve-deposit`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setIsDepositModalOpen(false);
      setSelectedOrder(null);
      setIsDrawerOpen(false);
      toast({ title: '계약금이 승인되었습니다.' });
    },
  });

  const updateDepositMutation = useMutation({
    mutationFn: async ({ orderId, depositAmount }: { orderId: number; depositAmount: number }) => {
      return apiRequest(`/orders/${orderId}/deposit-amount`, {
        method: 'PATCH',
        body: JSON.stringify({ depositAmount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      if (selectedOrder) {
        queryClient.invalidateQueries({ queryKey: ['admin-order', selectedOrder.id] });
      }
      setIsEditingDeposit(false);
      toast({ title: '계약금이 수정되었습니다.' });
    },
    onError: (error: any) => {
      toast({ title: `계약금 수정 실패: ${error.message || '알 수 없는 오류'}`, variant: 'destructive' });
    },
  });

  const assignHelperMutation = useMutation({
    mutationFn: async ({ orderId, helperId }: { orderId: number; helperId: string }) => {
      return apiRequest(`/orders/${orderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ helperId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-applications'] });
      setIsAssignModalOpen(false);
      setSelectedHelperId(null);
      setHelperSearchQuery('');
      setIsDrawerOpen(false);
      refetch();
      toast({ title: '헬퍼가 신청되었습니다.' });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest<{ success: boolean; assignedCount: number; helpers: { id: string; name: string; phone: string }[] }>(
        `/orders/${orderId}/bulk-assign`,
        { method: 'POST' }
      );
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-applications'] });
      setIsDrawerOpen(false);
      refetch();
      toast({ title: `${data?.assignedCount || 0}명의 헬퍼가 전체 배정되었습니다.` });
    },
    onError: (error: any) => {
      toast({ title: error.message || '전체 배정에 실패했습니다', variant: 'destructive' });
    },
  });

  const directAssignMutation = useMutation({
    mutationFn: async ({ orderId, helperIds }: { orderId: number; helperIds: string[] }) => {
      return apiRequest<{ success: boolean; assignedCount: number; helpers: { id: string; name: string; phone: string }[] }>(
        `/orders/${orderId}/direct-assign`,
        { method: 'POST', body: JSON.stringify({ helperIds }) }
      );
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-applications'] });
      setIsAssignModalOpen(false);
      setSelectedHelperIds(new Set());
      setHelperSearchQuery('');
      setIsDrawerOpen(false);
      refetch();
      toast({ title: `${data?.assignedCount || 0}명의 헬퍼가 배정되었습니다.` });
    },
    onError: (error: any) => {
      toast({ title: error.message || '배정에 실패했습니다', variant: 'destructive' });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ orderId, helperId }: { orderId: number; helperId: string }) => {
      return apiRequest<{ success: boolean; remainingHelpers: number; newStatus: string }>(
        `/orders/${orderId}/applications/${helperId}`,
        { method: 'DELETE' }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-applications'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      refetch();
      toast({ title: '헬퍼 배정이 해제되었습니다.' });
    },
    onError: (error: any) => {
      toast({ title: error.message || '배정 해제에 실패했습니다', variant: 'destructive' });
    },
  });

  const approveClosingMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest(`/orders/${orderId}/closing/approve`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setIsApproveClosingModalOpen(false);
      setSelectedOrder(null);
      setIsDrawerOpen(false);
      refetch();
      toast({ title: '마감이 승인되었습니다.' });
    },
  });

  const confirmBalanceMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest(`/orders/${orderId}/balance/manual-paid`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setIsConfirmBalanceModalOpen(false);
      setSelectedOrder(null);
      setIsDrawerOpen(false);
      refetch();
      toast({ title: '잔금이 확인되었습니다.' });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest(`/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      refetch();
      toast({ title: '오더가 취소되었습니다. 계약금이 있는 경우 결제관리 > 환불에서 확인하세요.' });
    },
  });

  const handleCancelOrder = async (orderId: number) => {
    const ok = await confirm({ title: '오더 반려', description: '이 오더를 반려하시겠습니까?' });
    if (ok) cancelOrderMutation.mutate(orderId);
  };

  const handleCancelUnassigned = async (orderId: number) => {
    const ok = await confirm({
      title: '취소/미배정',
      description: '미배정 오더를 취소하시겠습니까?\n계약금이 입금된 오더는 결제관리 > 환불 탭에서 환불 처리됩니다.',
    });
    if (ok) cancelOrderMutation.mutate(orderId);
  };

  const viewCounts = {
    all: orders.length,
    awaiting_deposit: orders.filter(o => normalizeOrderStatus(o.status) === ORDER_STATUS.AWAITING_DEPOSIT).length,
    open: orders.filter(o => normalizeOrderStatus(o.status) === ORDER_STATUS.OPEN).length,
    matching: orders.filter(o => normalizeOrderStatus(o.status) === ORDER_STATUS.MATCHING).length,
    scheduled: orders.filter(o => normalizeOrderStatus(o.status) === ORDER_STATUS.SCHEDULED).length,
    in_progress: orders.filter(o => normalizeOrderStatus(o.status) === ORDER_STATUS.IN_PROGRESS).length,
    closing: orders.filter(o => {
      const status = normalizeOrderStatus(o.status);
      return [ORDER_STATUS.CLOSING_SUBMITTED, ORDER_STATUS.FINAL_AMOUNT_CONFIRMED, ORDER_STATUS.BALANCE_PAID, ORDER_STATUS.SETTLEMENT_PAID, ORDER_STATUS.CLOSED].includes(status as any);
    }).length,
    unassigned_refund: orders.filter(o => normalizeOrderStatus(o.status) === ORDER_STATUS.CANCELLED).length,
  };

  const filteredOrders = orders.filter((order) => {
    const normalizedStatus = normalizeOrderStatus(order.status);
    
    // 탭별 필터링
    if (activeView === 'awaiting_deposit' && normalizedStatus !== ORDER_STATUS.AWAITING_DEPOSIT) return false;
    if (activeView === 'open' && normalizedStatus !== ORDER_STATUS.OPEN) return false;
    if (activeView === 'matching' && normalizedStatus !== ORDER_STATUS.MATCHING) return false;
    if (activeView === 'scheduled' && normalizedStatus !== ORDER_STATUS.SCHEDULED) return false;
    if (activeView === 'in_progress' && normalizedStatus !== ORDER_STATUS.IN_PROGRESS) return false;
    if (activeView === 'closing' && ![ORDER_STATUS.CLOSING_SUBMITTED, ORDER_STATUS.FINAL_AMOUNT_CONFIRMED, ORDER_STATUS.BALANCE_PAID, ORDER_STATUS.SETTLEMENT_PAID, ORDER_STATUS.CLOSED].includes(normalizedStatus as any)) return false;
    if (activeView === 'unassigned_refund' && normalizedStatus !== ORDER_STATUS.CANCELLED) return false;

    // 카테고리 필터링 (courierCategory가 없거나 빈 값이면 'parcel'로 간주)
    if (categoryFilter !== 'all') {
      const orderCategory = order.courierCategory || getCourierCategory(order.courierCompany || '');
      if (orderCategory !== categoryFilter) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return String(order.id).includes(q) ||
        order.requesterName.toLowerCase().includes(q) ||
        (order.requesterEmail || '').toLowerCase().includes(q) ||
        order.deliveryArea.toLowerCase().includes(q) ||
        order.campAddress.toLowerCase().includes(q) ||
        order.courierCompany.toLowerCase().includes(q) ||
        order.companyName.toLowerCase().includes(q);
    }
    return true;
  });

  const { toast } = useToast();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    toast({ title: '데이터를 새로고침했습니다.', variant: 'success' });
  };

  const handleDownloadExcel = () => {
    const data = filteredOrders.map(item => ({
      '오더번호': formatOrderNumber(item.orderNumber, item.id),
      '생성일시': item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '',
      '요청자': item.requesterName || '',
      '요청자이메일': item.requesterEmail || '',
      '택배사': item.companyName || '',
      '배송지': item.deliveryArea || '',
      '캠프주소': item.campAddress || '',
      '박스수': item.boxCount || 0,
      '단가': item.unitPrice || 0,
      '총액': item.totalAmount || 0,
      '상태': item.status || '',
      '헬퍼': item.helperName || '',
      '요청일': item.scheduledDate || '',
    }));
    downloadCSV(data, `오더목록_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    setDrawerTab('summary');
    setIsDrawerOpen(true);
  };

  const orderColumns: ColumnDef<Order>[] = [
    {
      key: 'id',
      header: '오더번호',
      width: 150,
      render: (value, row) => (
        <EntityLink
          type="order"
          id={value}
          label={formatOrderNumber(row.orderNumber, value)}
        />
      ),
    },
    {
      key: 'createdAt',
      header: '생성일시',
      width: 150,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </span>
      ),
    },
    {
      key: 'requesterEmail',
      header: '요청자(이메일)',
      width: 160,
      render: (value) => <span className="text-sm font-mono">{value || '-'}</span>,
    },
    {
      key: 'companyName',
      header: '택배사',
      width: 130,
      render: (value: any, row: any) => (
        <div className="flex items-center gap-1">
          <span className="text-sm">{value || '-'}</span>
          {!row.requesterId && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 whitespace-nowrap">관리자</span>
          )}
        </div>
      ),
    },
    {
      key: 'deliveryArea',
      header: '배송지/캠프',
      width: 200,
      render: (value, row) => (
        <div className="max-w-[200px]">
          <div className="text-sm truncate">{value || '-'}</div>
          <div className="text-xs text-muted-foreground truncate">{row.campAddress || ''}</div>
        </div>
      ),
    },
    {
      key: 'boxCount',
      header: '박스수',
      width: 70,
      align: 'center',
      render: (value) => value,
    },
    {
      key: 'unitPrice',
      header: '단가',
      width: 90,
      align: 'right',
      render: (value) => <Money amount={value} size="sm" />,
    },
    {
      key: 'scheduledDate',
      header: '요청일',
      width: 100,
      render: (value) => value ? (
        <span className="text-sm">
          {new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </span>
      ) : '-',
    },
    ...((['awaiting_deposit', 'open', 'closing'].includes(activeView)) ? [{
      key: 'status' as keyof Order,
      header: '액션',
      width: 180,
      render: (_: any, row: Order) => {
        const normalizedStatus = normalizeOrderStatus(row.status);
        return (
          <div className="flex gap-1 justify-end flex-wrap">
            {normalizedStatus === ORDER_STATUS.AWAITING_DEPOSIT && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrder(row);
                    setIsDepositModalOpen(true);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  승인
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500 text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrder(row);
                    handleCancelOrder(row.id);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  반려
                </Button>
              </>
            )}
            {normalizedStatus === ORDER_STATUS.OPEN && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrder(row);
                    setIsAssignModalOpen(true);
                  }}
                >
                  <Users className="h-4 w-4 mr-1" />
                  헬퍼신청
                </Button>
                {!row.matchedHelperId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(row);
                      handleCancelUnassigned(row.id);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    취소/미배정
                  </Button>
                )}
              </>
            )}
            {normalizedStatus === ORDER_STATUS.CLOSING_SUBMITTED && (
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrder(row);
                  setIsApproveClosingModalOpen(true);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                마감승인
              </Button>
            )}
            {normalizedStatus === ORDER_STATUS.FINAL_AMOUNT_CONFIRMED && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500 text-amber-600 hover:bg-amber-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrder(row);
                  setIsConfirmBalanceModalOpen(true);
                }}
              >
                <Banknote className="h-4 w-4 mr-1" />
                잔금확인
              </Button>
            )}
          </div>
        );
      },
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">오더 관리</h1>
          <p className="text-muted-foreground">공고/진행/완료 오더를 한 화면에서 운영, 수동배정 포함</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setIsCreateOrderModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            오더 등록
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className={cn("h-4 w-4 mr-1", autoRefresh && "animate-spin")} />
            새로고침
          </Button>
          <Button 
            variant={autoRefresh ? "default" : "outline"} 
            size="sm" 
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "자동 갱신 ON" : "자동 갱신"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredOrders.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-3">
        <button
          onClick={() => setActiveView('all')}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
            activeView === 'all'
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-700 border-gray-400 hover:bg-gray-50 dark:bg-white dark:text-gray-700 dark:border-gray-600"
          )}
        >
          <span className="text-2xl font-bold">{viewCounts.all}</span>
          <span className="mt-1">전체</span>
        </button>
        <button
          onClick={() => setActiveView('awaiting_deposit')}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
            activeView === 'awaiting_deposit'
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-white text-amber-600 border-amber-500 hover:bg-amber-50 dark:bg-white dark:text-amber-600 dark:border-amber-500"
          )}
        >
          <span className="text-2xl font-bold">{viewCounts.awaiting_deposit}</span>
          <span className="mt-1">승인대기</span>
        </button>
        <button
          onClick={() => setActiveView('open')}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
            activeView === 'open'
              ? "bg-blue-500 text-white border-blue-500"
              : "bg-white text-blue-600 border-blue-500 hover:bg-blue-50 dark:bg-white dark:text-blue-600 dark:border-blue-500"
          )}
        >
          <span className="text-2xl font-bold">{viewCounts.open}</span>
          <span className="mt-1">등록중</span>
        </button>
        <button
          onClick={() => setActiveView('matching')}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
            activeView === 'matching'
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-orange-600 border-orange-500 hover:bg-orange-50 dark:bg-white dark:text-orange-600 dark:border-orange-500"
          )}
        >
          <span className="text-2xl font-bold">{viewCounts.matching}</span>
          <span className="mt-1">매칭중</span>
        </button>
        <button
          onClick={() => setActiveView('scheduled')}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
            activeView === 'scheduled'
              ? "bg-purple-500 text-white border-purple-500"
              : "bg-white text-purple-600 border-purple-500 hover:bg-purple-50 dark:bg-white dark:text-purple-600 dark:border-purple-500"
          )}
        >
          <span className="text-2xl font-bold">{viewCounts.scheduled}</span>
          <span className="mt-1">예정</span>
        </button>
        <button
          onClick={() => setActiveView('in_progress')}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
            activeView === 'in_progress'
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-emerald-600 border-emerald-500 hover:bg-emerald-50 dark:bg-white dark:text-emerald-600 dark:border-emerald-500"
          )}
        >
          <span className="text-2xl font-bold">{viewCounts.in_progress}</span>
          <span className="mt-1">업무중</span>
        </button>
        <button
          onClick={() => setActiveView('closing')}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
            activeView === 'closing'
              ? "bg-teal-500 text-white border-teal-500"
              : "bg-white text-teal-600 border-teal-500 hover:bg-teal-50 dark:bg-white dark:text-teal-600 dark:border-teal-500"
          )}
        >
          <span className="text-2xl font-bold">{viewCounts.closing}</span>
          <span className="mt-1">마감</span>
        </button>
        <button
          onClick={() => setActiveView('unassigned_refund')}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
            activeView === 'unassigned_refund'
              ? "bg-red-500 text-white border-red-500"
              : "bg-white text-red-600 border-red-500 hover:bg-red-50 dark:bg-white dark:text-red-600 dark:border-red-500"
          )}
        >
          <span className="text-2xl font-bold">{viewCounts.unassigned_refund}</span>
          <span className="mt-1">취소/미배정</span>
        </button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={categoryFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategoryFilter('all')}
        >
          전체
        </Button>
        <Button
          variant={categoryFilter === 'parcel' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategoryFilter('parcel')}
        >
          택배사
        </Button>
        <Button
          variant={categoryFilter === 'other' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategoryFilter('other')}
        >
          기타택배
        </Button>
        <Button
          variant={categoryFilter === 'cold' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategoryFilter('cold')}
        >
          냉탑전용
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            오더 목록
            {selectedIds.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedIds.size}개 선택)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Input
                placeholder="오더ID, 요청자, 주소 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter className="h-4 w-4 mr-2" />
              필터
              <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", filterOpen && "rotate-180")} />
            </Button>
          </div>
          {filterOpen && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">상태</label>
                <select className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="">전체</option>
                  <option value="awaiting_deposit">입금대기</option>
                  <option value="open">지원가능</option>
                  <option value="scheduled">예정됨</option>
                  <option value="in_progress">진행중</option>
                  <option value="closing_submitted">마감제출</option>
                  <option value="final_amount_confirmed">마감확정</option>
                  <option value="balance_paid">잔금완료</option>
                  <option value="settlement_paid">정산완료</option>
                  <option value="closed">종료</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">지역</label>
                <select className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="">전체</option>
                  <option value="서울">서울</option>
                  <option value="경기">경기</option>
                  <option value="인천">인천</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  미배정만 표시
                </label>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={filteredOrders}
            columns={orderColumns}
            loading={isLoading}
            emptyMessage="오더 데이터가 없습니다"
            getRowId={(row) => row.id}
            storageKey="admin-orders"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
            onRowClick={handleRowClick}
          />
          
          {pagination && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
              onItemsPerPageChange={(limit) => {
                setItemsPerPage(limit);
                setCurrentPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>

      <DrawerDetail
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`오더 ${formatOrderNumber(selectedOrder?.orderNumber, selectedOrder?.id || 0)}`}
        subtitle={selectedOrder?.requesterName}
        tabs={[
          {
            id: 'summary',
            label: '상세내역',
            content: (
              <div className="border rounded-lg overflow-hidden bg-white">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <h3 className="font-bold text-center text-lg">배송 오더 상세</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b bg-blue-50">
                      <td colSpan={2} className="px-3 py-2 font-bold text-blue-800">요청자 정보</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium w-1/3 border-r">이름</td>
                      <td className="px-3 py-2">{displayOrder?.requesterName || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">이메일</td>
                      <td className="px-3 py-2">{displayOrder?.requesterEmail || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">전화번호</td>
                      <td className="px-3 py-2">{displayOrder?.requesterPhone || '-'}</td>
                    </tr>
                    <tr className="border-b bg-green-50">
                      <td colSpan={2} className="px-3 py-2 font-bold text-green-800">헬퍼 정보</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">수행 헬퍼</td>
                      <td className="px-3 py-2">
                        {displayOrder?.helperName ? (
                          <div className="flex items-center gap-3">
                            {displayOrder?.helperProfileImage ? (
                              <img 
                                src={displayOrder.helperProfileImage} 
                                alt="헬퍼 프로필"
                                className="w-10 h-10 rounded-full object-cover border-2 border-green-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <Users className="h-5 w-5 text-green-600" />
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-green-700">{displayOrder?.helperName}</span>
                              {displayOrder?.helperTeamName && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  <Badge variant="outline" className="text-xs">{displayOrder.helperTeamName}</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">미배정</span>
                        )}
                      </td>
                    </tr>
                    {displayOrder?.helperPhone && (
                      <tr className="border-b">
                        <td className="bg-gray-50 px-3 py-2 font-medium border-r">헬퍼 연락처</td>
                        <td className="px-3 py-2">{displayOrder.helperPhone}</td>
                      </tr>
                    )}
                    <tr className="border-b bg-orange-50">
                      <td colSpan={2} className="px-3 py-2 font-bold text-orange-800">오더 정보</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">카테고리</td>
                      <td className="px-3 py-2 flex items-center gap-1">
                        <Badge variant="outline">
                          {(() => {
                            const cat = displayOrder?.courierCategory || getCourierCategory(displayOrder?.courierCompany || '');
                            return cat === 'parcel' ? '택배' : cat === 'other' ? '기타택배' : '냉탑전용';
                          })()}
                        </Badge>
                        {!displayOrder?.requesterId && (
                          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">관리자</Badge>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">운송사</td>
                      <td className="px-3 py-2">{displayOrder?.companyName || displayOrder?.courierCompany || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">평균수량</td>
                      <td className="px-3 py-2">{displayOrder?.averageQuantity || displayOrder?.boxCount || 0} 박스</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">단가 / 운송료</td>
                      <td className="px-3 py-2"><Money amount={displayOrder?.unitPrice || 0} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">배송지역</td>
                      <td className="px-3 py-2">{displayOrder?.deliveryArea || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">배송지 이미지</td>
                      <td className="px-3 py-2">
                        {displayOrder?.regionMapUrl ? (
                          <img
                            src={displayOrder?.regionMapUrl}
                            alt="배송지 이미지"
                            className="max-w-full h-auto rounded border cursor-pointer hover:opacity-90"
                            style={{ maxHeight: '200px' }}
                            onClick={() => window.open(displayOrder?.regionMapUrl, '_blank')}
                          />
                        ) : (
                          <span className="text-muted-foreground">이미지 없음</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">캠프/터미널 (상차지)</td>
                      <td className="px-3 py-2">{displayOrder?.campAddress || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">요청일</td>
                      <td className="px-3 py-2">
                        {displayOrder?.scheduledDate 
                          ? new Date(displayOrder.scheduledDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) 
                          : '-'}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">담당자 연락처</td>
                      <td className="px-3 py-2">{displayOrder?.contactPhone || displayOrder?.requesterPhone || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">배송가이드</td>
                      <td className="px-3 py-2 whitespace-pre-wrap text-xs">
                        {displayOrder?.deliveryGuide || '등록된 배송가이드가 없습니다.'}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">잔금 결제 예정일</td>
                      <td className="px-3 py-2">
                        {displayOrder?.balancePaymentDueDate 
                          ? new Date(displayOrder.balancePaymentDueDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) 
                          : '-'}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">계약금</td>
                      <td className="px-3 py-2">
                        {isEditingDeposit ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editDepositAmount}
                              onChange={(e) => setEditDepositAmount(e.target.value)}
                              className="w-32 h-8"
                              placeholder="금액 입력"
                            />
                            <span className="text-sm text-gray-500">원</span>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8"
                              onClick={() => {
                                if (selectedOrder && editDepositAmount) {
                                  updateDepositMutation.mutate({
                                    orderId: selectedOrder.id,
                                    depositAmount: Number(editDepositAmount),
                                  });
                                }
                              }}
                              disabled={updateDepositMutation.isPending}
                            >
                              {updateDepositMutation.isPending ? '저장중...' : '저장'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => setIsEditingDeposit(false)}
                            >
                              취소
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Money amount={displayOrder?.depositAmount || 0} />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setEditDepositAmount(String(displayOrder?.depositAmount || 0));
                                setIsEditingDeposit(true);
                              }}
                            >
                              수정
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">계약 상태</td>
                      <td className="px-3 py-2">
                        {displayOrder?.contractConfirmed ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="success" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              계약 확정
                            </Badge>
                            {displayOrder?.contractConfirmedAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(displayOrder.contractConfirmedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-xs">계약 미확정</Badge>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: 'applicants',
            label: `지원자 (${applications.length})`,
            content: (() => {
              const appliedCount = applications.filter(a => a.status === 'applied').length;
              const approvedCount = applications.filter(a => a.status === 'approved' || a.status === 'scheduled' || a.status === 'in_progress').length;
              const maxHelpers = (selectedOrder as any)?.maxHelpers || 3;
              const isEnterprise = !!displayOrder?.enterpriseId;
              const canRemove = isEnterprise && (
                normalizeOrderStatus(selectedOrder?.status) === ORDER_STATUS.OPEN ||
                normalizeOrderStatus(selectedOrder?.status) === ORDER_STATUS.SCHEDULED
              );
              return applications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isEnterprise ? '배정된 헬퍼가 없습니다' : '지원자가 없습니다'}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 현황 요약 */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm">
                      <span className="font-medium text-blue-800">
                        {isEnterprise ? '배정 현황: ' : '신청 현황: '}
                      </span>
                      <span className="text-blue-700">
                        {isEnterprise ? `${approvedCount} / ${maxHelpers}명` : `${appliedCount} / ${maxHelpers}명`}
                      </span>
                    </div>
                    {!isEnterprise && appliedCount > 0 && normalizeOrderStatus(selectedOrder?.status) === ORDER_STATUS.OPEN && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={async () => {
                          const ok = await confirm({
                            title: '전체 배정 확인',
                            description: `신청된 ${appliedCount}명을 전체 배정하시겠습니까?\n배정 시 헬퍼에게 푸시알림과 의뢰인 연락처가 전송됩니다.`,
                          });
                          if (ok) {
                            bulkAssignMutation.mutate(selectedOrder!.id);
                          }
                        }}
                        disabled={bulkAssignMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {bulkAssignMutation.isPending ? '배정 중...' : `전체 배정 (${appliedCount}명)`}
                      </Button>
                    )}
                  </div>

                  {/* 지원자/배정 헬퍼 목록 */}
                  {applications.map((app) => (
                    <div key={app.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium">{app.helperName || '헬퍼'}</span>
                          <span className="text-sm text-muted-foreground ml-2">{app.helperPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={app.status === 'applied' ? 'default' : app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {app.status === 'applied' ? '신청중' : app.status === 'approved' ? '배정됨' : app.status === 'rejected' ? '해제됨' : app.status}
                          </Badge>
                          {canRemove && (app.status === 'approved' || app.status === 'applied') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: '배정 해제',
                                  description: `${app.helperName || '헬퍼'}의 배정을 해제하시겠습니까?`,
                                });
                                if (ok && selectedOrder) {
                                  removeAssignmentMutation.mutate({
                                    orderId: selectedOrder.id,
                                    helperId: app.helperId,
                                  });
                                }
                              }}
                              disabled={removeAssignmentMutation.isPending}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>
                      {app.message && (
                        <p className="text-sm text-muted-foreground mb-2">{app.message}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {new Date(app.appliedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })(),
          },
          {
            id: 'contracts',
            label: '계약정보',
            content: (
              <div className="space-y-4">
                {/* 계약 확정 상태 */}
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="bg-purple-50 px-4 py-2 border-b">
                    <h4 className="font-bold text-purple-800">계약 확정 상태</h4>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="bg-gray-50 px-3 py-2 font-medium w-1/3 border-r">계약 상태</td>
                        <td className="px-3 py-2">
                          {displayOrder?.contractConfirmed ? (
                            <Badge variant="success">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              계약 확정 완료
                            </Badge>
                          ) : (
                            <Badge variant="secondary">계약 미확정</Badge>
                          )}
                        </td>
                      </tr>
                      {displayOrder?.contractConfirmedAt && (
                        <tr className="border-b">
                          <td className="bg-gray-50 px-3 py-2 font-medium border-r">확정 일시</td>
                          <td className="px-3 py-2">
                            {new Date(displayOrder.contractConfirmedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                          </td>
                        </tr>
                      )}
                      {displayOrder?.signatureData && (
                        <tr className="border-b">
                          <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">의뢰인 서명</td>
                          <td className="px-3 py-2">
                            <img
                              src={displayOrder.signatureData.startsWith('data:') ? displayOrder.signatureData : `data:image/png;base64,${displayOrder.signatureData}`}
                              alt="의뢰인 서명"
                              className="max-w-[200px] h-auto border rounded bg-white p-1"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </td>
                        </tr>
                      )}
                      <tr className="border-b">
                        <td className="bg-gray-50 px-3 py-2 font-medium border-r">잔금 입금 예정일</td>
                        <td className="px-3 py-2">
                          {displayOrder?.balancePaymentDueDate
                            ? new Date(displayOrder.balancePaymentDueDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
                            : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-gray-50 px-3 py-2 font-medium border-r">계약금</td>
                        <td className="px-3 py-2">
                          <Money amount={displayOrder?.depositAmount || 0} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 계약서 전문 + 프린트 */}
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="bg-indigo-50 px-4 py-2 border-b flex items-center justify-between">
                    <h4 className="font-bold text-indigo-800">계약서 전문</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const iframe = document.getElementById(`contract-iframe-${selectedOrder?.id}`) as HTMLIFrameElement;
                          if (iframe?.contentWindow) {
                            iframe.contentWindow.print();
                          }
                        }}
                      >
                        🖨️ 프린트
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!contractHtml) return;
                          // PDF 저장용: 새 창을 열고 자동으로 인쇄 다이얼로그 표시
                          // 브라우저에서 "PDF로 저장"을 선택하면 법정 제출용 PDF 생성
                          const win = window.open('', '_blank');
                          if (win) {
                            win.document.write(contractHtml);
                            win.document.close();
                            // 로딩 완료 후 인쇄 다이얼로그 자동 표시
                            win.onload = () => win.print();
                            // fallback: onload가 안 먹을 경우 setTimeout
                            setTimeout(() => {
                              try { win.print(); } catch {}
                            }, 500);
                          }
                        }}
                        disabled={!contractHtml}
                      >
                        📄 PDF 저장 (법정 제출용)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // 새창에서 계약서 HTML 직접 표시
                          const win = window.open('', '_blank');
                          if (win && contractHtml) {
                            win.document.write(contractHtml);
                            win.document.close();
                          }
                        }}
                        disabled={!contractHtml}
                      >
                        새창 열기
                      </Button>
                    </div>
                  </div>
                  <div className="p-2">
                    {contractHtml ? (
                      <iframe
                        id={`contract-iframe-${selectedOrder?.id}`}
                        srcDoc={contractHtml}
                        className="w-full border rounded"
                        style={{ height: '600px' }}
                        title="계약서 전문"
                      />
                    ) : contractHtmlLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        계약서를 불러오는 중...
                      </div>
                    ) : contractHtmlError ? (
                      <div className="text-center py-8 text-red-500">
                        계약서를 불러올 수 없습니다. 계약 데이터를 확인해주세요.
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        계약서가 아직 생성되지 않았습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* 기존 계약 레코드 (contracts 테이블) */}
                {contracts.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-gray-700">계약 레코드 ({contracts.length})</h4>
                    {contracts.map((contract) => (
                      <div key={contract.id} className="border rounded-lg overflow-hidden bg-white">
                        <div className="bg-gray-50 px-4 py-2 border-b">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-700">계약 #{contract.id}</span>
                            <Badge variant={contract.status === 'active' ? 'success' : 'secondary'}>
                              {contract.status === 'active' ? '활성' : contract.status === 'pending' ? '대기' : contract.status}
                            </Badge>
                          </div>
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            <tr className="border-b">
                              <td className="bg-gray-50 px-3 py-2 font-medium w-1/3 border-r">계약일시</td>
                              <td className="px-3 py-2">
                                {contract.signedAt
                                  ? new Date(contract.signedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                                  : contract.createdAt
                                    ? new Date(contract.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                                    : '-'}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="bg-gray-50 px-3 py-2 font-medium border-r">헬퍼</td>
                              <td className="px-3 py-2">
                                {contract.helperName || '미지정'}
                                {contract.helperPhone && <span className="text-muted-foreground ml-2">({contract.helperPhone})</span>}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="bg-gray-50 px-3 py-2 font-medium border-r">요청자</td>
                              <td className="px-3 py-2">
                                {contract.requesterName || '-'}
                                {contract.requesterPhone && <span className="text-muted-foreground ml-2">({contract.requesterPhone})</span>}
                              </td>
                            </tr>
                            {contract.requesterSignature && (
                              <tr className="border-b">
                                <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">요청자 서명</td>
                                <td className="px-3 py-2">
                                  <img
                                    src={contract.requesterSignature.startsWith('data:') ? contract.requesterSignature : `data:image/png;base64,${contract.requesterSignature}`}
                                    alt="요청자 서명"
                                    className="max-w-[200px] h-auto border rounded bg-white p-1"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </td>
                              </tr>
                            )}
                            {contract.helperSignature && (
                              <tr className="border-b">
                                <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">헬퍼 서명</td>
                                <td className="px-3 py-2">
                                  <img
                                    src={contract.helperSignature}
                                    alt="헬퍼 서명"
                                    className="max-w-[200px] h-auto border rounded bg-white p-1"
                                  />
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: 'closing',
            label: '마감자료',
            content: !closingReport ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">마감 자료가 없습니다</p>
                {displayOrder && ['closing_submitted', 'final_amount_confirmed', 'balance_paid', 'settlement_paid'].includes(displayOrder.status?.toLowerCase() || '') && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left max-w-md mx-auto">
                    <p className="text-yellow-800 text-sm font-medium">⚠️ 데이터 불일치 감지</p>
                    <p className="text-yellow-700 text-xs mt-1">
                      오더 상태가 &apos;{displayOrder.status}&apos;이지만 마감 보고서가 없습니다.
                      DB 스키마 변경(db:push) 시 데이터가 삭제되었을 수 있습니다.
                      헬퍼에게 마감 재제출을 요청하거나, 관리자가 수동으로 처리해주세요.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-white">
                <div className="bg-teal-50 px-4 py-2 border-b">
                  <h3 className="font-bold text-center text-lg text-teal-800">마감 자료 상세</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b bg-blue-50">
                      <td colSpan={2} className="px-3 py-2 font-bold text-blue-800">수량 정보</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium w-1/3 border-r">배송 수량</td>
                      <td className="px-3 py-2 font-bold text-lg">{closingReport.deliveredCount} 건</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">반품 수량</td>
                      <td className="px-3 py-2 font-bold text-lg">{closingReport.returnedCount} 건</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">기타 수량</td>
                      <td className="px-3 py-2 font-bold text-lg">{closingReport.etcCount || 0} 건</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">제출 일시</td>
                      <td className="px-3 py-2">{closingReport.createdAt ? new Date(closingReport.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">상태</td>
                      <td className="px-3 py-2">
                        <Badge variant={closingReport.status === 'submitted' ? 'default' : closingReport.status === 'approved' ? 'success' : 'secondary'}>
                          {closingReport.status === 'submitted' ? '제출됨' : closingReport.status === 'approved' ? '승인됨' : closingReport.status}
                        </Badge>
                      </td>
                    </tr>
                    {closingReport.memo ? (
                      <tr className="border-b">
                        <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">메모</td>
                        <td className="px-3 py-2 whitespace-pre-wrap">{closingReport.memo}</td>
                      </tr>
                    ) : null}
                    {closingReport.extraCostsJson && closingReport.extraCostsJson.length > 0 ? (
                      <>
                        <tr className="border-b bg-orange-50">
                          <td colSpan={2} className="px-3 py-2 font-bold text-orange-800">추가 항목</td>
                        </tr>
                        {closingReport.extraCostsJson.map((item, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="bg-gray-50 px-3 py-2 font-medium border-r">{item.name}</td>
                            <td className="px-3 py-2">
                              {item.unitPrice?.toLocaleString()}원 x {item.quantity} = {((item.unitPrice || 0) * (item.quantity || 1)).toLocaleString()}원
                            </td>
                          </tr>
                        ))}
                      </>
                    ) : null}
                    {closingReport.deliveryHistoryImages?.length > 0 ? (
                      <>
                        <tr className="border-b bg-green-50">
                          <td colSpan={2} className="px-3 py-2 font-bold text-green-800">배송이력 이미지 ({closingReport.deliveryHistoryImages.length})</td>
                        </tr>
                        <tr className="border-b">
                          <td colSpan={2} className="px-3 py-2">
                            <div className="grid grid-cols-4 gap-2">
                              {closingReport.deliveryHistoryImages.map((img, idx) => (
                                <a key={idx} href={img.startsWith('http') ? img : `${window.location.origin}${img}`} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={img.startsWith('http') ? img : `${window.location.origin}${img}`} 
                                    alt={`배송이력 ${idx + 1}`}
                                    className="w-full aspect-square object-cover rounded border hover:opacity-80"
                                  />
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </>
                    ) : null}
                    {closingReport.etcImages?.length > 0 ? (
                      <>
                        <tr className="border-b bg-purple-50">
                          <td colSpan={2} className="px-3 py-2 font-bold text-purple-800">기타 이미지 ({closingReport.etcImages.length})</td>
                        </tr>
                        <tr>
                          <td colSpan={2} className="px-3 py-2">
                            <div className="grid grid-cols-4 gap-2">
                              {closingReport.etcImages.map((img, idx) => (
                                <a key={idx} href={img.startsWith('http') ? img : `${window.location.origin}${img}`} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={img.startsWith('http') ? img : `${window.location.origin}${img}`} 
                                    alt={`기타 ${idx + 1}`}
                                    className="w-full aspect-square object-cover rounded border hover:opacity-80"
                                  />
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ),
          },
        ]}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        footer={
          (() => {
            const normalizedStatus = normalizeOrderStatus(displayOrder?.status);
            const actions = displayOrder ? getOrderActionState({ id: displayOrder.id, status: displayOrder.status }) : null;
            return (
              <div className="flex flex-col gap-2">
                {normalizedStatus === ORDER_STATUS.AWAITING_DEPOSIT && (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setIsDepositModalOpen(true)}
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    입금 확인 (등록 승인)
                  </Button>
                )}
                {actions?.canSelectHelper && displayOrder?.enterpriseId && (
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => {
                      setSelectedHelperIds(new Set());
                      setHelperSearchQuery('');
                      setIsAssignModalOpen(true);
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    헬퍼 배정
                  </Button>
                )}
                {!selectedOrder?.matchedHelperId && actions?.canSelectHelper && !displayOrder?.enterpriseId && (
                  <>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setIsAssignModalOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      수동 신청
                    </Button>
                    {applications.filter(a => a.status === 'applied').length > 0 && (
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={async () => {
                          const appliedCount = applications.filter(a => a.status === 'applied').length;
                          const ok = await confirm({
                            title: '전체 배정 확인',
                            description: `신청된 ${appliedCount}명을 전체 배정하시겠습니까?\n배정 시 헬퍼에게 푸시알림과 의뢰인 연락처가 전송됩니다.`,
                          });
                          if (ok) {
                            bulkAssignMutation.mutate(selectedOrder!.id);
                          }
                        }}
                        disabled={bulkAssignMutation.isPending}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        {bulkAssignMutation.isPending ? '배정 중...' : `전체 배정 (${applications.filter(a => a.status === 'applied').length}명)`}
                      </Button>
                    )}
                  </>
                )}
                {actions?.canApproveClosing && (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => setIsApproveClosingModalOpen(true)}
                    disabled={approveClosingMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    마감 승인
                  </Button>
                )}
                {actions?.canConfirmBalance && (
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={() => setIsConfirmBalanceModalOpen(true)}
                    disabled={confirmBalanceMutation.isPending}
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    잔금 확인
                  </Button>
                )}
              </div>
            );
          })()
        }
      />

      {isAssignModalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => {
              setIsAssignModalOpen(false);
              setSelectedHelperId(null);
              setSelectedHelperIds(new Set());
              setHelperSearchQuery('');
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background rounded-lg shadow-xl">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                {displayOrder?.enterpriseId ? '본사 헬퍼 배정' : '헬퍼 신청'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {displayOrder?.enterpriseId
                  ? `오더 ${formatOrderNumber(selectedOrder?.orderNumber, selectedOrder?.id || 0)}에 배정할 헬퍼를 선택하세요. (최대 ${(selectedOrder as any)?.maxHelpers || 3}명)`
                  : `오더 ${formatOrderNumber(selectedOrder?.orderNumber, selectedOrder?.id || 0)}에 신청할 헬퍼를 선택하세요.`
                }
              </p>
              {displayOrder?.enterpriseId && selectedHelperIds.size > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Array.from(selectedHelperIds).map(hId => {
                    const h = helpers.find(x => x.id === hId);
                    return (
                      <Badge key={hId} variant="default" className="flex items-center gap-1 pr-1">
                        {h?.name || hId}
                        <button
                          className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                          onClick={() => {
                            const next = new Set(selectedHelperIds);
                            next.delete(hId);
                            setSelectedHelperIds(next);
                          }}
                        >
                          ✕
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              <Input
                placeholder="헬퍼 이름 또는 전화번호 검색..."
                value={helperSearchQuery}
                onChange={(e) => setHelperSearchQuery(e.target.value)}
              />
              <div className="space-y-2">
                {helpers
                  .filter(h =>
                    h.name.toLowerCase().includes(helperSearchQuery.toLowerCase()) ||
                    (h.phoneNumber && h.phoneNumber.includes(helperSearchQuery))
                  )
                  .slice(0, 20)
                  .map((helper) => {
                    const isEnterprise = !!displayOrder?.enterpriseId;
                    const isSelected = isEnterprise
                      ? selectedHelperIds.has(helper.id)
                      : selectedHelperId === helper.id;
                    const maxHelpers = (selectedOrder as any)?.maxHelpers || 3;
                    const alreadyAssigned = applications.filter(a =>
                      a.status === 'approved' || a.status === 'applied' || a.status === 'scheduled' || a.status === 'in_progress'
                    );
                    const isAlreadyApplied = alreadyAssigned.some(a => a.helperId === helper.id);
                    const isMaxReached = isEnterprise && !isSelected && (selectedHelperIds.size + alreadyAssigned.length >= maxHelpers);

                    return (
                      <div
                        key={helper.id}
                        className={cn(
                          "p-3 border rounded-lg flex items-center justify-between",
                          isAlreadyApplied
                            ? "bg-gray-100 opacity-60 cursor-not-allowed"
                            : isMaxReached
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer hover:bg-muted/50",
                          isSelected && "border-primary bg-primary/5"
                        )}
                        onClick={() => {
                          if (isAlreadyApplied || isMaxReached) return;
                          if (isEnterprise) {
                            const next = new Set(selectedHelperIds);
                            if (next.has(helper.id)) {
                              next.delete(helper.id);
                            } else {
                              next.add(helper.id);
                            }
                            setSelectedHelperIds(next);
                          } else {
                            setSelectedHelperId(helper.id);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {isEnterprise && (
                            <div className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                              isSelected ? "bg-primary border-primary text-white" : "border-gray-300",
                              isAlreadyApplied && "bg-gray-300 border-gray-300"
                            )}>
                              {(isSelected || isAlreadyApplied) && <span className="text-xs">✓</span>}
                            </div>
                          )}
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {helper.name}
                              {isAlreadyApplied && <Badge variant="outline" className="text-xs">배정됨</Badge>}
                              <button
                                className="text-xs text-blue-500 hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  _setHelperDetailId(helper.id);
                                  setIsHelperDetailOpen(true);
                                }}
                              >
                                상세보기
                              </button>
                            </div>
                            <div className="text-sm text-muted-foreground">{helper.phoneNumber || '연락처 없음'}</div>
                            {helper.teamName && (
                              <div className="text-xs text-muted-foreground">팀: {helper.teamName}</div>
                            )}
                          </div>
                        </div>
                        {helper.dailyStatus && (
                          <Badge variant={helper.dailyStatus === 'available' ? 'success' : 'secondary'}>
                            {helper.dailyStatus === 'available' ? '대기중' : helper.dailyStatus}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                {helpers.filter(h =>
                  h.name.toLowerCase().includes(helperSearchQuery.toLowerCase()) ||
                  (h.phoneNumber && h.phoneNumber.includes(helperSearchQuery))
                ).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    {helperSearchQuery ? '검색 결과가 없습니다' : '헬퍼 목록을 불러오는 중...'}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedHelperId(null);
                  setSelectedHelperIds(new Set());
                  setHelperSearchQuery('');
                }}
              >
                취소
              </Button>
              {displayOrder?.enterpriseId ? (
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    if (selectedOrder && selectedHelperIds.size > 0) {
                      directAssignMutation.mutate({
                        orderId: selectedOrder.id,
                        helperIds: Array.from(selectedHelperIds),
                      });
                    }
                  }}
                  disabled={selectedHelperIds.size === 0 || directAssignMutation.isPending}
                >
                  {directAssignMutation.isPending ? '배정 중...' : `즉시 배정 (${selectedHelperIds.size}명)`}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (selectedOrder && selectedHelperId) {
                      assignHelperMutation.mutate({ orderId: selectedOrder.id, helperId: selectedHelperId });
                    }
                  }}
                  disabled={!selectedHelperId || assignHelperMutation.isPending}
                >
                  {assignHelperMutation.isPending ? '신청 중...' : '신청 확정'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      <ReasonModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onSubmit={() => {
          if (selectedOrder) {
            approveDepositMutation.mutate(selectedOrder.id);
          }
        }}
        title="입금 확인"
        description={`오더 ${formatOrderNumber(selectedOrder?.orderNumber, selectedOrder?.id || 0)}의 예치금 입금을 확인하고 오더를 등록합니다. 이 작업 후 헬퍼들이 해당 오더를 볼 수 있게 됩니다.`}
        submitText="입금 확인 및 등록"
        minLength={0}
      />

      <ReasonModal
        isOpen={isApproveClosingModalOpen}
        onClose={() => setIsApproveClosingModalOpen(false)}
        onSubmit={() => {
          if (selectedOrder) {
            approveClosingMutation.mutate(selectedOrder.id);
          }
        }}
        title="마감 승인"
        description={`오더 ${formatOrderNumber(selectedOrder?.orderNumber, selectedOrder?.id || 0)}의 마감보고를 확인하고 최종 금액을 확정합니다. 승인 후 요청자에게 잔금 청구가 진행됩니다.`}
        submitText="마감 승인"
        minLength={0}
      />

      <ReasonModal
        isOpen={isConfirmBalanceModalOpen}
        onClose={() => setIsConfirmBalanceModalOpen(false)}
        onSubmit={() => {
          if (selectedOrder) {
            confirmBalanceMutation.mutate(selectedOrder.id);
          }
        }}
        title="잔금 확인"
        description={`오더 ${formatOrderNumber(selectedOrder?.orderNumber, selectedOrder?.id || 0)}의 잔금 입금을 확인합니다. 확인 후 기사 정산이 가능해집니다.`}
        submitText="잔금 확인"
        minLength={0}
      />

      <HelperDetailModal
        helperId={helperDetailId}
        isOpen={isHelperDetailOpen}
        onClose={() => setIsHelperDetailOpen(false)}
      />

      {/* 오더 등록 모달 (본사 계약권) */}
      <Dialog open={isCreateOrderModalOpen} onOpenChange={setIsCreateOrderModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>본사 계약권 오더 등록</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* 협력업체 검색 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">협력업체 검색 (선택)</Label>
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    value={newOrderForm.enterpriseId ? newOrderForm.enterpriseName : enterpriseSearch}
                    onChange={(e) => {
                      setEnterpriseSearch(e.target.value);
                      setShowEnterpriseDropdown(true);
                      if (newOrderForm.enterpriseId) {
                        setNewOrderForm(prev => ({ ...prev, enterpriseId: null, enterpriseName: '', companyName: '', settlementDate: '' }));
                      }
                    }}
                    onFocus={() => enterpriseSearch.length >= 1 && setShowEnterpriseDropdown(true)}
                    placeholder="업체명으로 검색..."
                    className={newOrderForm.enterpriseId ? 'bg-blue-50 border-blue-300' : ''}
                    disabled={!!newOrderForm.enterpriseId}
                  />
                  {newOrderForm.enterpriseId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewOrderForm(prev => ({ ...prev, enterpriseId: null, enterpriseName: '', companyName: '', settlementDate: '' }));
                        setEnterpriseSearch('');
                      }}
                      className="shrink-0"
                    >
                      초기화
                    </Button>
                  )}
                </div>
                {showEnterpriseDropdown && !newOrderForm.enterpriseId && enterpriseSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {enterpriseSearchResults.map((ent: any) => (
                      <button
                        key={ent.id}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between text-sm"
                        onClick={() => {
                          setNewOrderForm(prev => ({
                            ...prev,
                            enterpriseId: ent.id,
                            enterpriseName: ent.name,
                            companyName: ent.name,
                          }));
                          setEnterpriseSearch('');
                          setShowEnterpriseDropdown(false);
                        }}
                      >
                        <span className="font-medium">{ent.name}</span>
                        <span className="text-xs text-muted-foreground">수수료 {ent.commissionRate ?? 10}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {newOrderForm.enterpriseId && (
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-1.5 rounded">
                  <span>✅</span>
                  <span className="font-medium">{newOrderForm.enterpriseName}</span>
                  <span className="text-blue-500">(수수료 자동 적용)</span>
                </div>
              )}
              {newOrderForm.enterpriseId && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">정산일</label>
                  <input
                    type="date"
                    className="flex-1 h-9 px-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={newOrderForm.settlementDate}
                    onChange={(e) => setNewOrderForm(prev => ({ ...prev, settlementDate: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* 카테고리 탭 */}
            <div className="flex gap-2 border-b pb-2">
              {(['택배사', '기타택배', '냉탑전용'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setOrderCategoryTab(tab);
                    const category = tab === '택배사' ? 'parcel' : tab === '기타택배' ? 'other' : 'cold';
                    setNewOrderForm(prev => ({ 
                      ...prev, 
                      courierCategory: category,
                      carrierCode: '',
                      courierCompany: tab === '기타택배' ? '기타' : tab === '냉탑전용' ? '냉탑전용' : '',
                    }));
                  }}
                  className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                    orderCategoryTab === tab
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* 택배사 카테고리 */}
            {orderCategoryTab === '택배사' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="carrierCode">택배사 *</Label>
                    <Select
                      value={newOrderForm.carrierCode}
                      onValueChange={(value) => {
                        const courier = couriers.find(c => c.code === value);
                        setNewOrderForm(prev => ({ 
                          ...prev, 
                          carrierCode: value,
                          courierCompany: courier?.name || '',
                          courierCategory: 'parcel',
                          pricePerUnit: courier?.basePricePerBox || 1200,
                          unitPriceManual: (courier?.basePricePerBox || 1200).toString(),
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="택배사 선택" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5} className="max-h-60 overflow-y-auto z-[100]">
                        {couriers.filter(c => c.category === 'parcel').map((courier) => (
                          <SelectItem key={courier.code} value={courier.code}>
                            {courier.name} ({courier.basePricePerBox.toLocaleString()}원)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="averageQuantity">평균수량 (박스)</Label>
                    <Input
                      id="averageQuantity"
                      value={newOrderForm.averageQuantity}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, averageQuantity: e.target.value }))}
                      placeholder="예: 300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unitPriceManual">단가 (VAT별도) *</Label>
                    <Input
                      id="unitPriceManual"
                      value={newOrderForm.unitPriceManual}
                      onChange={(e) => setNewOrderForm(prev => ({ 
                        ...prev, 
                        unitPriceManual: e.target.value,
                        pricePerUnit: parseInt(e.target.value) || 0
                      }))}
                      placeholder="예: 1200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">차종 *</Label>
                    <Select
                      value={newOrderForm.vehicleType}
                      onValueChange={(value) => setNewOrderForm(prev => ({ ...prev, vehicleType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="차종 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1톤 하이탑">1톤 하이탑</SelectItem>
                        <SelectItem value="1톤정탑">1톤정탑</SelectItem>
                        <SelectItem value="1톤저탑">1톤저탑</SelectItem>
                        <SelectItem value="1톤 냉탑">1톤 냉탑</SelectItem>
                        <SelectItem value="무관">무관</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">입차일 *</Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={newOrderForm.scheduledDate}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDateEnd">입차종료일</Label>
                    <Input
                      id="scheduledDateEnd"
                      type="date"
                      value={newOrderForm.scheduledDateEnd}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, scheduledDateEnd: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveryArea">배송지역 *</Label>
                  <Input
                    id="deliveryArea"
                    value={newOrderForm.deliveryArea}
                    onChange={(e) => setNewOrderForm(prev => ({ ...prev, deliveryArea: e.target.value }))}
                    placeholder="예: 서울시 강남구"
                  />
                </div>
              </>
            )}

            {/* 기타택배 카테고리 */}
            {orderCategoryTab === '기타택배' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">업체명</Label>
                    <Input
                      id="companyName"
                      value={newOrderForm.companyName}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="업체명 (선택)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="averageQuantity">박스수량 *</Label>
                    <Input
                      id="averageQuantity"
                      value={newOrderForm.averageQuantity}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, averageQuantity: e.target.value }))}
                      placeholder="예: 300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>단가 기준 *</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priceType"
                        checked={newOrderForm.priceType === 'perBox'}
                        onChange={() => setNewOrderForm(prev => ({ ...prev, priceType: 'perBox' }))}
                        className="w-4 h-4"
                      />
                      <span>박스당</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priceType"
                        checked={newOrderForm.priceType === 'perDestination'}
                        onChange={() => setNewOrderForm(prev => ({ ...prev, priceType: 'perDestination' }))}
                        className="w-4 h-4"
                      />
                      <span>착지당</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unitPriceManual">단가 (원) *</Label>
                    <Input
                      id="unitPriceManual"
                      value={newOrderForm.unitPriceManual}
                      onChange={(e) => setNewOrderForm(prev => ({ 
                        ...prev, 
                        unitPriceManual: e.target.value,
                        pricePerUnit: parseInt(e.target.value) || 0
                      }))}
                      placeholder="예: 1800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">차종 *</Label>
                    <Select
                      value={newOrderForm.vehicleType}
                      onValueChange={(value) => setNewOrderForm(prev => ({ ...prev, vehicleType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="차종 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1톤 하이탑">1톤 하이탑</SelectItem>
                        <SelectItem value="1톤정탑">1톤정탑</SelectItem>
                        <SelectItem value="1톤저탑">1톤저탑</SelectItem>
                        <SelectItem value="1톤 냉탑">1톤 냉탑</SelectItem>
                        <SelectItem value="무관">무관</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">입차일 *</Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={newOrderForm.scheduledDate}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDateEnd">입차종료일</Label>
                    <Input
                      id="scheduledDateEnd"
                      type="date"
                      value={newOrderForm.scheduledDateEnd}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, scheduledDateEnd: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveryArea">배송지역 *</Label>
                  <Input
                    id="deliveryArea"
                    value={newOrderForm.deliveryArea}
                    onChange={(e) => setNewOrderForm(prev => ({ ...prev, deliveryArea: e.target.value }))}
                    placeholder="예: 서울시 강남구"
                  />
                </div>
              </>
            )}

            {/* 냉탑전용 카테고리 */}
            {orderCategoryTab === '냉탑전용' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="coldCompanyName">업체명 *</Label>
                    <Input
                      id="coldCompanyName"
                      value={newOrderForm.coldCompanyName}
                      onChange={(e) => setNewOrderForm(prev => ({ 
                        ...prev, 
                        coldCompanyName: e.target.value,
                        courierCompany: e.target.value,
                        courierCategory: 'cold',
                      }))}
                      placeholder="업체명 입력"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">차종 *</Label>
                    <Select
                      value={newOrderForm.vehicleType}
                      onValueChange={(value) => setNewOrderForm(prev => ({ ...prev, vehicleType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="차종 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1톤 하이탑">1톤 하이탑</SelectItem>
                        <SelectItem value="1톤정탑">1톤정탑</SelectItem>
                        <SelectItem value="1톤저탑">1톤저탑</SelectItem>
                        <SelectItem value="1톤 냉탑">1톤 냉탑</SelectItem>
                        <SelectItem value="무관">무관</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">입차일 *</Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={newOrderForm.scheduledDate}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDateEnd">입차종료일</Label>
                    <Input
                      id="scheduledDateEnd"
                      type="date"
                      value={newOrderForm.scheduledDateEnd}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, scheduledDateEnd: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="campAddress">상차지 *</Label>
                  <Input
                    id="campAddress"
                    value={newOrderForm.campAddress}
                    onChange={(e) => setNewOrderForm(prev => ({ ...prev, campAddress: e.target.value }))}
                    placeholder="상차지 주소"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="freight">운임 *</Label>
                  <Input
                    id="freight"
                    value={newOrderForm.freight}
                    onChange={(e) => setNewOrderForm(prev => ({ ...prev, freight: e.target.value }))}
                    placeholder="예: 200,000원"
                  />
                </div>

                <div className="space-y-2">
                  <Label>경유지</Label>
                  {newOrderForm.waypoints.map((wp, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={wp}
                        onChange={(e) => {
                          const newWaypoints = [...newOrderForm.waypoints];
                          newWaypoints[idx] = e.target.value;
                          setNewOrderForm(prev => ({ ...prev, waypoints: newWaypoints }));
                        }}
                        placeholder={`경유지 ${idx + 1}`}
                      />
                      {newOrderForm.waypoints.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newWaypoints = newOrderForm.waypoints.filter((_, i) => i !== idx);
                            setNewOrderForm(prev => ({ ...prev, waypoints: newWaypoints }));
                          }}
                        >
                          삭제
                        </Button>
                      )}
                    </div>
                  ))}
                  {newOrderForm.waypoints.length < 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewOrderForm(prev => ({ 
                        ...prev, 
                        waypoints: [...prev.waypoints, ''] 
                      }))}
                    >
                      + 경유지 추가
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* 공통 필드 */}
            <div className="border-t pt-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campAddress">캠프/터미널 주소</Label>
                  <Input
                    id="campAddress"
                    value={newOrderForm.campAddress}
                    onChange={(e) => setNewOrderForm(prev => ({ ...prev, campAddress: e.target.value }))}
                    placeholder="캠프 또는 터미널 주소"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">현장 연락처</Label>
                  <Input
                    id="contactPhone"
                    value={newOrderForm.contactPhone}
                    onChange={(e) => setNewOrderForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="deliveryGuide">배송 안내사항</Label>
                <Input
                  id="deliveryGuide"
                  value={newOrderForm.deliveryGuide}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, deliveryGuide: e.target.value }))}
                  placeholder="배송 시 참고사항을 입력하세요"
                />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isUrgent"
                  checked={newOrderForm.isUrgent}
                  onChange={(e) => setNewOrderForm(prev => ({ ...prev, isUrgent: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="isUrgent">긴급 오더</Label>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mt-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  본사 계약권 오더는 계약금 없이 바로 &apos;등록중&apos; 상태로 게시됩니다.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOrderModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => createOrderMutation.mutate(newOrderForm)}
              disabled={
                (orderCategoryTab === '택배사' && !newOrderForm.carrierCode) ||
                (orderCategoryTab === '기타택배' && (!newOrderForm.averageQuantity || !newOrderForm.unitPriceManual)) ||
                (orderCategoryTab === '냉탑전용' && (!newOrderForm.coldCompanyName || !newOrderForm.freight)) ||
                !newOrderForm.scheduledDate ||
                !newOrderForm.vehicleType ||
                createOrderMutation.isPending
              }
            >
              {createOrderMutation.isPending ? '등록 중...' : '오더 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
