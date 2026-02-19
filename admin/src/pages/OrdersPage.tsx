import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { downloadCSV } from '@/utils/csv-export';
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
import { CheckCircle, RefreshCw, Download, Filter, ChevronDown, UserPlus, CircleCheck, Banknote, XCircle, Users, Plus } from 'lucide-react';
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
  const [dateRange, setDateRange] = useState(getDefaultDateRange(7));
  const [activeView, setActiveView] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'parcel' | 'other' | 'cold'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
  });

  const { data: ordersResponse, isLoading, refetch } = useQuery({
    queryKey: ['admin-orders', dateRange, currentPage, itemsPerPage, searchQuery],
    refetchInterval: autoRefresh ? 10000 : false, // 자동 새로고침 시 10초마다
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append('page', '1');
        params.append('limit', '500');
        if (searchQuery) params.append('search', searchQuery);
        
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
            unitPrice: o.unitPrice || o.pricePerBox || 0,
            totalAmount: o.totalAmount || 0,
            status: o.status || 'open',
            matchedHelperId: o.matchedHelperId,
            helperName: o.helperName,
            deadline: o.deadline || o.workDate,
            requestedDate: o.requestedDate || o.workDate || o.deadline || o.scheduledDate,
            scheduledDate: o.scheduledDate,
            paymentStatus: o.paymentStatus,
            settlementStatus: o.settlementStatus,
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

  interface Helper {
    id: string;
    name: string;
    phoneNumber?: string;
    dailyStatus?: string;
  }

  const { data: helpers = [] } = useQuery<Helper[]>({
    queryKey: ['admin-helpers'],
    queryFn: async () => {
      try {
        const data = await apiRequest<any[]>('/users?role=helper');
        return data.map((h: any) => ({
          id: h.id,
          name: h.name || '이름없음',
          phoneNumber: h.phoneNumber,
          dailyStatus: h.dailyStatus,
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
      });
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
          unitPrice: data.unitPrice || data.pricePerBox || 0,
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
      toast({ title: '헬퍼가 배정되었습니다.' });
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
      toast({ title: '오더가 반려되었습니다.' });
    },
  });

  const handleCancelOrder = async (orderId: number) => {
    const ok = await confirm({ title: '오더 반려', description: '이 오더를 반려하시겠습니까?' });
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
      '오더번호': item.id,
      '생성일시': item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '',
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
      width: 90,
      render: (value) => <EntityLink type="order" id={value} />,
    },
    {
      key: 'createdAt',
      header: '생성일시',
      width: 150,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleString('ko-KR')}
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
      width: 100,
      render: (value) => <span className="text-sm">{value || '-'}</span>,
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
          {new Date(value).toLocaleDateString('ko-KR')}
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
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrder(row);
                  _setHelperDetailId(row.matchedHelperId || null);
                  setIsHelperDetailOpen(true);
                }}
              >
                <Users className="h-4 w-4 mr-1" />
                헬퍼배정
              </Button>
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
          <span className="mt-1">미배정환불</span>
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
        title={`오더 ORD-${selectedOrder?.id}`}
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
                      <td className="px-3 py-2">{selectedOrder?.requesterName || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">이메일</td>
                      <td className="px-3 py-2">{selectedOrder?.requesterEmail || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">전화번호</td>
                      <td className="px-3 py-2">{selectedOrder?.requesterPhone || '-'}</td>
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
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">신청자 목록</td>
                      <td className="px-3 py-2">
                        {applications.length > 0 ? (
                          <div className="space-y-1">
                            {applications.map((app) => (
                              <div key={app.id} className="flex items-center gap-2 text-xs">
                                <span className={app.status === 'approved' ? 'font-medium text-green-700' : ''}>
                                  {app.helperName || '헬퍼'}
                                </span>
                                <Badge variant={app.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                                  {app.status === 'applied' ? '신청' : app.status === 'approved' ? '배정' : app.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">신청자 없음</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b bg-orange-50">
                      <td colSpan={2} className="px-3 py-2 font-bold text-orange-800">오더 정보</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">카테고리</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">
                          {(() => {
                            const cat = selectedOrder?.courierCategory || getCourierCategory(selectedOrder?.courierCompany || '');
                            return cat === 'parcel' ? '택배' : cat === 'other' ? '기타택배' : '냉탑전용';
                          })()}
                        </Badge>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">운송사</td>
                      <td className="px-3 py-2">{displayOrder?.companyName || displayOrder?.courierCompany || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">평균수량</td>
                      <td className="px-3 py-2">{selectedOrder?.averageQuantity || selectedOrder?.boxCount || 0} 박스</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">단가 / 운송료</td>
                      <td className="px-3 py-2"><Money amount={selectedOrder?.unitPrice || 0} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">배송지역</td>
                      <td className="px-3 py-2">{selectedOrder?.deliveryArea || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">배송지 이미지</td>
                      <td className="px-3 py-2">
                        {selectedOrder?.regionMapUrl ? (
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
                      <td className="px-3 py-2">{selectedOrder?.campAddress || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">요청일</td>
                      <td className="px-3 py-2">
                        {displayOrder?.scheduledDate 
                          ? new Date(displayOrder.scheduledDate).toLocaleDateString('ko-KR') 
                          : '-'}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">담당자 연락처</td>
                      <td className="px-3 py-2">{selectedOrder?.contactPhone || selectedOrder?.requesterPhone || '-'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">배송가이드</td>
                      <td className="px-3 py-2 whitespace-pre-wrap text-xs">
                        {selectedOrder?.deliveryGuide || '등록된 배송가이드가 없습니다.'}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">잔금 결제 예정일</td>
                      <td className="px-3 py-2">
                        {displayOrder?.balancePaymentDueDate 
                          ? new Date(displayOrder.balancePaymentDueDate).toLocaleDateString('ko-KR') 
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
                      <td className="bg-gray-50 px-3 py-2 font-medium border-r">계약서</td>
                      <td className="px-3 py-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`/api/orders/${selectedOrder?.id}/contract/pdf`, '_blank')}
                        >
                          계약서 출력
                        </Button>
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
            content: applications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                지원자가 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium">{app.helperName || '헬퍼'}</span>
                        <span className="text-sm text-muted-foreground ml-2">{app.helperPhone}</span>
                      </div>
                      <Badge variant={app.status === 'applied' ? 'default' : app.status === 'approved' ? 'success' : 'secondary'}>
                        {app.status === 'applied' ? '신청중' : app.status === 'approved' ? '배정됨' : app.status}
                      </Badge>
                    </div>
                    {app.message && (
                      <p className="text-sm text-muted-foreground mb-2">{app.message}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(app.appliedAt).toLocaleString('ko-KR')}
                      </span>
                      {app.status === 'applied' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedHelperId(app.helperId);
                              setIsAssignModalOpen(true);
                            }}
                          >
                            <CircleCheck className="h-4 w-4 mr-1" />
                            배정
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: 'contracts',
            label: `계약정보 (${contracts.length})`,
            content: contracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                계약 정보가 없습니다
              </div>
            ) : (
              <div className="space-y-4">
                {contracts.map((contract) => (
                  <div key={contract.id} className="border rounded-lg overflow-hidden bg-white">
                    <div className="bg-purple-50 px-4 py-2 border-b">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-purple-800">계약 #{contract.id}</h4>
                        <Badge variant={contract.status === 'active' ? 'success' : 'secondary'}>
                          {contract.status === 'active' ? '활성' : contract.status}
                        </Badge>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="bg-gray-50 px-3 py-2 font-medium w-1/3 border-r">계약일시</td>
                          <td className="px-3 py-2">
                            {contract.signedAt 
                              ? new Date(contract.signedAt).toLocaleString('ko-KR')
                              : contract.createdAt 
                                ? new Date(contract.createdAt).toLocaleString('ko-KR')
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
                        <tr className="border-b">
                          <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">요청자 서명</td>
                          <td className="px-3 py-2">
                            {contract.requesterSignature ? (
                              <img 
                                src={contract.requesterSignature} 
                                alt="요청자 서명" 
                                className="max-w-[200px] h-auto border rounded bg-white p-1"
                              />
                            ) : (
                              <span className="text-muted-foreground">서명 없음</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="bg-gray-50 px-3 py-2 font-medium border-r align-top">헬퍼 서명</td>
                          <td className="px-3 py-2">
                            {contract.helperSignature ? (
                              <img 
                                src={contract.helperSignature} 
                                alt="헬퍼 서명" 
                                className="max-w-[200px] h-auto border rounded bg-white p-1"
                              />
                            ) : (
                              <span className="text-muted-foreground">서명 없음</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: 'closing',
            label: '마감자료',
            content: !closingReport ? (
              <div className="text-center py-8 text-muted-foreground">
                마감 자료가 없습니다
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
                      <td className="px-3 py-2">{closingReport.createdAt ? new Date(closingReport.createdAt).toLocaleString('ko-KR') : '-'}</td>
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
                {!selectedOrder?.matchedHelperId && actions?.canSelectHelper && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setIsAssignModalOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    수동 배정
                  </Button>
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
              setHelperSearchQuery('');
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background rounded-lg shadow-xl">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">헬퍼 배정</h3>
              <p className="text-sm text-muted-foreground mt-1">
                오더 ORD-{selectedOrder?.id}에 배정할 헬퍼를 선택하세요.
              </p>
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
                  .map((helper) => (
                    <div
                      key={helper.id}
                      className={cn(
                        "p-3 border rounded-lg cursor-pointer hover:bg-muted/50 flex items-center justify-between",
                        selectedHelperId === helper.id && "border-primary bg-primary/5"
                      )}
                      onClick={() => setSelectedHelperId(helper.id)}
                    >
                      <div>
                        <div className="font-medium">{helper.name}</div>
                        <div className="text-sm text-muted-foreground">{helper.phoneNumber || '연락처 없음'}</div>
                      </div>
                      {helper.dailyStatus && (
                        <Badge variant={helper.dailyStatus === 'available' ? 'success' : 'secondary'}>
                          {helper.dailyStatus === 'available' ? '대기중' : helper.dailyStatus}
                        </Badge>
                      )}
                    </div>
                  ))}
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
                  setHelperSearchQuery('');
                }}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  if (selectedOrder && selectedHelperId) {
                    assignHelperMutation.mutate({ orderId: selectedOrder.id, helperId: selectedHelperId });
                  }
                }}
                disabled={!selectedHelperId || assignHelperMutation.isPending}
              >
                {assignHelperMutation.isPending ? '배정 중...' : '배정 확정'}
              </Button>
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
        description={`오더 ORD-${selectedOrder?.id}의 예치금 입금을 확인하고 오더를 등록합니다. 이 작업 후 헬퍼들이 해당 오더를 볼 수 있게 됩니다.`}
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
        description={`오더 ORD-${selectedOrder?.id}의 마감보고를 확인하고 최종 금액을 확정합니다. 승인 후 요청자에게 잔금 청구가 진행됩니다.`}
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
        description={`오더 ORD-${selectedOrder?.id}의 잔금 입금을 확인합니다. 확인 후 기사 정산이 가능해집니다.`}
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
