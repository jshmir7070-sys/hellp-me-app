import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import {
  Wallet,
  RefreshCw,
  Download,
  Search,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  CalendarDays,
  Check,
  AlertCircle,
  CreditCard,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker, getDefaultDateRange, Pagination } from '@/components/common';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// ============ 인터페이스 정의 ============

interface ExtraItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

interface DailySettlement {
  id: number;
  orderId: number;
  orderNumber?: string | null;
  helperId: number;
  helperName?: string;
  helperPhone?: string;
  requesterName?: string;
  category?: string;
  courierCompany?: string;
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  extraCostsJson: ExtraItem[] | null;
  closingMemo: string;
  createdAt: string;
  pricePerBox: number;
  driverPayout: number;
  platformFee: number;
  finalTotal: number;
}

interface HelperSettlement {
  helperId: number;
  helperName: string;
  helperPhone: string;
  helperEmail: string;
  orderCount: number;
  supplyPrice: number;
  vat: number;
  totalAmount: number;
  platformFee: number;
  deductedAmount: number;
  deductions: number;
  cargoIncident: number;
  driverPayout: number;
}

interface RequesterSettlement {
  requesterId: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string;
  businessName: string;
  orderCount: number;
  billedAmount: number;
  unpaidAmount: number;
  paymentDate: string | null;
}

interface TaxInvoice {
  id: number;
  targetType: 'helper' | 'requester';
  targetId: string;
  targetName: string;
  businessName?: string;
  businessNumber?: string;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  issueDate: string | null;
  status: 'draft' | 'issued' | 'sent' | 'failed' | 'cancelled';
  popbillNtsConfirmNum?: string;
  year: number;
  month: number;
  createdAt: string;
  updatedAt: string;
}

// ============ 공통 설정 ============

const CATEGORY_LABELS: Record<string, string> = {
  parcel: '택배사',
  other: '기타택배',
  cold: '냉탑전용',
};

const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return amount.toLocaleString('ko-KR') + '원';
}

function getMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function formatOrderNumber(orderNumber: string | null | undefined, orderId: number): string {
  if (orderNumber) {
    if (orderNumber.length === 12) {
      return `${orderNumber.slice(0, 1)}-${orderNumber.slice(1, 4)}-${orderNumber.slice(4, 8)}-${orderNumber.slice(8, 12)}`;
    }
    return orderNumber;
  }
  return `#${orderId}`;
}

// ============ 메인 컴포넌트 ============

export default function SettlementsPageV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<'daily' | 'helper' | 'requester' | 'tax-invoices'>('daily');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 일정산용 날짜 범위
  const [dailyDateRange, setDailyDateRange] = useState(() => getDefaultDateRange(30));
  
  // 헬퍼/요청자 정산용 월별 선택
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const monthRange = getMonthRange(selectedYear, selectedMonth);
  
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [selectedDailySettlement, setSelectedDailySettlement] = useState<DailySettlement | null>(null);
  const [selectedHelper, setSelectedHelper] = useState<HelperSettlement | null>(null);
  const [selectedRequester, setSelectedRequester] = useState<RequesterSettlement | null>(null);

  // 페이지네이션 상태
  const [dailyPage, setDailyPage] = useState(1);
  const [helperPage, setHelperPage] = useState(1);
  const [requesterPage, setRequesterPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // 입금 확인 모달 상태
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'bank_transfer' as string,
    transactionId: '',
    paidAmount: '',
    notes: '',
  });

  // 헬퍼 정산 상세 모달 - 일정산 내역 상태
  const [orderDetails, setOrderDetails] = useState<any[]>([]);
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [editingDeductions, setEditingDeductions] = useState<Record<number, number>>({});
  const [editingMemos, setEditingMemos] = useState<Record<number, string>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [savingDeduction, setSavingDeduction] = useState<number | null>(null);

  // 헬퍼 정산 상세 - 오더별 데이터 로드
  const fetchOrderDetails = async (helperId: number) => {
    setLoadingOrders(true);
    try {
      const res = await adminFetch(
        `/api/admin/settlements/helper/${helperId}/orders?startDate=${monthRange.from}&endDate=${monthRange.to}`
      );
      if (!res.ok) throw new Error('조회 실패');
      const data = await res.json();
      setOrderDetails(data.orders || []);
      setOrderSummary(data.summary || null);
    } catch {
      setOrderDetails([]);
      setOrderSummary(null);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (selectedHelper) {
      fetchOrderDetails(selectedHelper.helperId);
    } else {
      setOrderDetails([]);
      setOrderSummary(null);
      setEditingDeductions({});
      setEditingMemos({});
      setExpandedOrderId(null);
    }
  }, [selectedHelper]);

  // 요청자 정산 상세 모달 - 오더별 내역 상태
  const [requesterOrderDetails, setRequesterOrderDetails] = useState<any[]>([]);
  const [requesterOrderSummary, setRequesterOrderSummary] = useState<any>(null);
  const [loadingRequesterOrders, setLoadingRequesterOrders] = useState(false);

  const fetchRequesterOrderDetails = async (requesterId: string) => {
    setLoadingRequesterOrders(true);
    try {
      const res = await adminFetch(
        `/api/admin/settlements/requester/${requesterId}/orders?startDate=${monthRange.from}&endDate=${monthRange.to}`
      );
      if (!res.ok) throw new Error('조회 실패');
      const data = await res.json();
      setRequesterOrderDetails(data.orders || []);
      setRequesterOrderSummary(data.summary || null);
    } catch {
      setRequesterOrderDetails([]);
      setRequesterOrderSummary(null);
    } finally {
      setLoadingRequesterOrders(false);
    }
  };

  useEffect(() => {
    if (selectedRequester) {
      fetchRequesterOrderDetails(selectedRequester.requesterId);
    } else {
      setRequesterOrderDetails([]);
      setRequesterOrderSummary(null);
    }
  }, [selectedRequester]);

  const handleDeductionChange = (orderId: number, value: number) => {
    setEditingDeductions(prev => ({ ...prev, [orderId]: value }));
  };

  const handleMemoChange = (orderId: number, value: string) => {
    setEditingMemos(prev => ({ ...prev, [orderId]: value }));
  };

  const handleSaveDeduction = async (orderId: number, helperId: number) => {
    setSavingDeduction(orderId);
    try {
      const amount = editingDeductions[orderId];
      const memo = editingMemos[orderId];
      const res = await adminFetch(`/api/admin/settlements/helper/${helperId}/orders/${orderId}/deduction`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deductionAmount: amount, adminMemo: memo }),
      });
      if (!res.ok) throw new Error('저장 실패');
      toast({ title: '차감액 저장 완료', variant: 'default' });
      fetchOrderDetails(helperId);
      setEditingDeductions(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      setEditingMemos(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    } catch {
      toast({ title: '차감액 저장 실패', variant: 'destructive' });
    } finally {
      setSavingDeduction(null);
    }
  };

  // ============ 데이터 조회 ============

  // 일정산
  const { data: dailySettlements = [], isLoading: loadingDaily } = useQuery({
    queryKey: ['/api/admin/settlements/daily', dailyDateRange.from, dailyDateRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/daily?startDate=${dailyDateRange.from}&endDate=${dailyDateRange.to}&limit=9999`);
      if (!res.ok) return [];
      const json = await res.json();
      // API가 { data: [...], pagination: {...} } 형식으로 반환
      return Array.isArray(json) ? json : (json.data || []);
    },
  });

  // 헬퍼 정산
  const { data: helperSettlements = [], isLoading: loadingHelper } = useQuery({
    queryKey: ['/api/admin/settlements/helper', monthRange.from, monthRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/helper?startDate=${monthRange.from}&endDate=${monthRange.to}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 요청자 정산
  const { data: requesterSettlements = [], isLoading: loadingRequester } = useQuery<RequesterSettlement[]>({
    queryKey: ["/api/admin/settlements/requester", monthRange.from, monthRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/requester?startDate=${monthRange.from}&endDate=${monthRange.to}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 세금계산서
  const [taxInvoicePage, setTaxInvoicePage] = useState(1);
  const [taxInvoiceFilter, setTaxInvoiceFilter] = useState<'all' | 'helper' | 'requester'>('all');
  const [selectedTaxInvoice, setSelectedTaxInvoice] = useState<TaxInvoice | null>(null);

  const { data: taxInvoices = [], isLoading: loadingTaxInvoices } = useQuery<TaxInvoice[]>({
    queryKey: ['/api/admin/tax-invoices', selectedYear, selectedMonth, taxInvoiceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth + 1),
      });
      if (taxInvoiceFilter !== 'all') {
        params.set('targetType', taxInvoiceFilter);
      }
      const res = await adminFetch(`/api/admin/tax-invoices?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : (json.data || json.taxInvoices || []);
    },
    enabled: activeTab === 'tax-invoices',
  });

  const isLoading = loadingDaily || loadingHelper || loadingRequester || loadingTaxInvoices;

  // URL ?id= 파라미터로 정산 상세 자동 오픈
  const autoOpenHandled = useRef(false);
  useEffect(() => {
    if (autoOpenHandled.current) return;
    const targetId = searchParams.get('id');
    if (!targetId || !dailySettlements.length) return;

    const settlementId = Number(targetId);
    const found = (dailySettlements as DailySettlement[]).find((s) => s.id === settlementId);
    if (found) {
      setActiveTab('daily');
      setSelectedDailySettlement(found);
      autoOpenHandled.current = true;
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    } else if (settlementId > 0) {
      // 현재 날짜 범위에 없으면 API로 직접 조회
      adminFetch(`/api/admin/settlements/daily?id=${settlementId}`).then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json) ? json : (json.data || []);
          const item = items.find((s: any) => s.id === settlementId);
          if (item) {
            setActiveTab('daily');
            setSelectedDailySettlement(item);
          }
        }
      }).catch(() => { /* 조회 실패 시 무시 */ });
      autoOpenHandled.current = true;
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    }
  }, [dailySettlements, searchParams, setSearchParams]);

  // ============ 필터링 ============

  const filteredDailySettlements = dailySettlements.filter((s: DailySettlement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.orderId.toString().includes(search) ||
      s.helperName?.toLowerCase().includes(search) ||
      s.requesterName?.toLowerCase().includes(search) ||
      s.courierCompany?.toLowerCase().includes(search)
    );
  });

  const filteredHelperSettlements = helperSettlements.filter((h: HelperSettlement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      h.helperName.toLowerCase().includes(search) ||
      h.helperPhone.includes(search) ||
      h.helperId.toString().includes(search)
    );
  });

  const filteredRequesterSettlements = requesterSettlements.filter((r: RequesterSettlement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.requesterName.toLowerCase().includes(search) ||
      r.requesterPhone.includes(search) ||
      r.businessName.toLowerCase().includes(search) ||
      r.requesterId.toString().includes(search)
    );
  });

  // ============ 통계 계산 ============

  const dailyStats = {
    count: filteredDailySettlements.length,
    totalDriverPayout: filteredDailySettlements.reduce((sum: number, s: DailySettlement) => sum + (s.driverPayout || 0), 0),
    totalPlatformFee: filteredDailySettlements.reduce((sum: number, s: DailySettlement) => sum + (s.platformFee || 0), 0),
    totalFinal: filteredDailySettlements.reduce((sum: number, s: DailySettlement) => sum + (s.finalTotal || 0), 0),
  };

  const helperStats = {
    count: filteredHelperSettlements.length,
    totalOrders: filteredHelperSettlements.reduce((sum: number, h: HelperSettlement) => sum + (h.orderCount || 0), 0),
    totalDriverPayout: filteredHelperSettlements.reduce((sum: number, h: HelperSettlement) => sum + (h.driverPayout || 0), 0),
    totalPlatformFee: filteredHelperSettlements.reduce((sum: number, h: HelperSettlement) => sum + (h.platformFee || 0), 0),
  };

  const requesterStats = {
    count: filteredRequesterSettlements.length,
    totalOrders: filteredRequesterSettlements.reduce((sum: number, r: RequesterSettlement) => sum + (r.orderCount || 0), 0),
    totalBilled: filteredRequesterSettlements.reduce((sum: number, r: RequesterSettlement) => sum + (r.billedAmount || 0), 0),
    totalUnpaid: filteredRequesterSettlements.reduce((sum: number, r: RequesterSettlement) => sum + (r.unpaidAmount || 0), 0),
  };

  const filteredTaxInvoices = taxInvoices.filter((inv: TaxInvoice) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      inv.targetName?.toLowerCase().includes(search) ||
      inv.businessName?.toLowerCase().includes(search) ||
      inv.businessNumber?.includes(search) ||
      inv.popbillNtsConfirmNum?.includes(search) ||
      inv.targetId?.toString().includes(search)
    );
  });

  const taxInvoiceStats = {
    count: filteredTaxInvoices.length,
    totalSupply: filteredTaxInvoices.reduce((sum: number, inv: TaxInvoice) => sum + (inv.supplyAmount || 0), 0),
    totalVat: filteredTaxInvoices.reduce((sum: number, inv: TaxInvoice) => sum + (inv.vatAmount || 0), 0),
    totalAmount: filteredTaxInvoices.reduce((sum: number, inv: TaxInvoice) => sum + (inv.totalAmount || 0), 0),
    issuedCount: filteredTaxInvoices.filter((inv: TaxInvoice) => inv.status === 'issued' || inv.status === 'sent').length,
    draftCount: filteredTaxInvoices.filter((inv: TaxInvoice) => inv.status === 'draft').length,
  };

  // ============ 액션 핸들러 ============

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/daily'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/helper'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/requester'] });
    toast({ title: '데이터를 새로고침했습니다.', variant: 'success' });
  };

  const handleDownloadExcel = () => {
    let data: any[] = [];
    let filename = '';

    if (activeTab === 'daily') {
      data = filteredDailySettlements.map((item: DailySettlement) => ({
        '오더번호': formatOrderNumber(item.orderNumber, item.orderId),
        '요청자': item.requesterName || '',
        '헬퍼': item.helperName || '',
        '헬퍼연락처': item.helperPhone || '',
        '카테고리': CATEGORY_LABELS[item.category || ''] || item.category || '',
        '운송사': item.courierCompany || '',
        '배송수량': item.deliveredCount || 0,
        '반품수량': item.returnedCount || 0,
        '기타수량': item.etcCount || 0,
        '박스단가': item.pricePerBox || 0,
        '최종금액': item.finalTotal || 0,
        '플랫폼수수료': item.platformFee || 0,
        '헬퍼지급액': item.driverPayout || 0,
        '마감일시': item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '',
      }));
      filename = `일정산_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (activeTab === 'helper') {
      data = filteredHelperSettlements.map((item: HelperSettlement) => ({
        '헬퍼ID': item.helperId,
        '헬퍼명': item.helperName,
        '연락처': item.helperPhone,
        '오더수': item.orderCount,
        '공급가': item.supplyPrice,
        '부가세': item.vat,
        '총액': item.totalAmount,
        '플랫폼수수료': item.platformFee,
        '차감액': item.deductedAmount,
        '지급액': item.driverPayout,
      }));
      filename = `헬퍼정산_${selectedYear}년${selectedMonth + 1}월.csv`;
    } else {
      data = filteredRequesterSettlements.map((item: RequesterSettlement) => ({
        '요청자ID': item.requesterId,
        '요청자명': item.requesterName,
        '사업자명': item.businessName,
        '연락처': item.requesterPhone,
        '오더수': item.orderCount,
        '청구금액': item.billedAmount,
        '미수금액': item.unpaidAmount,
        '입금일': item.paymentDate || '',
      }));
      filename = `요청자정산_${selectedYear}년${selectedMonth + 1}월.csv`;
    }

    if (data.length === 0) {
      toast({ title: '다운로드할 데이터가 없습니다.', variant: 'warning' });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) => headers.map(h => row[h]).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Excel 다운로드 완료', variant: 'success' });
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // ============ 정산 기능 Mutations ============

  // 1. 거래명세서 다운로드 (헬퍼 주문 상세 → CSV)
  const handleDownloadStatement = async (helper: HelperSettlement) => {
    try {
      const res = await adminFetch(
        `/api/admin/settlements/helper/${helper.helperId}/orders?startDate=${monthRange.from}&endDate=${monthRange.to}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '거래명세서 조회 실패');
      }
      const data = await res.json();
      const orders = data.orders || [];

      if (orders.length === 0) {
        toast({ title: '해당 기간 거래 내역이 없습니다.', variant: 'warning' });
        return;
      }

      // CSV 생성
      const csvRows = orders.map((o: any, i: number) => ({
        '순번': i + 1,
        '오더번호': o.orderId || '',
        '작업일': o.createdAt ? new Date(o.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '',
        '요청자': o.requesterName || '',
        '카테고리': CATEGORY_LABELS[o.category || ''] || o.category || '',
        '운송사': o.courierCompany || '',
        '배송수량': o.deliveredCount || 0,
        '반품수량': o.returnedCount || 0,
        '박스단가': o.pricePerBox || 0,
        '공급가': o.supplyAmount || 0,
        '부가세': o.vatAmount || 0,
        '차감액': o.deduction || 0,
        '지급액': o.payout || 0,
      }));

      const headers = Object.keys(csvRows[0]);
      const csvContent = [
        `거래명세서 - ${helper.helperName} (${selectedYear}년 ${selectedMonth + 1}월)`,
        '',
        headers.join(','),
        ...csvRows.map((row: Record<string, unknown>) => headers.map(h => row[h]).join(',')),
        '',
        `합계,,,,,,,,${data.summary?.totalSupply || 0},${data.summary?.totalVat || 0},${data.summary?.totalDeduction || 0},${data.summary?.totalPayout || 0}`,
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `거래명세서_${helper.helperName}_${selectedYear}년${selectedMonth + 1}월.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: '거래명세서 다운로드 완료', variant: 'success' });
    } catch (err: any) {
      toast({ title: err.message || '거래명세서 다운로드 실패', variant: 'error' });
    }
  };

  // 2. 정산 확정 (헬퍼 정산의 일정산 건들을 confirm)
  const confirmSettlementMutation = useMutation({
    mutationFn: async (helperId: number) => {
      // 헬퍼의 해당 월 일정산 건들을 가져와서 각각 confirm 처리
      const relevantDaily = dailySettlements.filter(
        (d: DailySettlement) => d.helperId === helperId
      );
      if (relevantDaily.length === 0) {
        throw new Error('확정할 정산 건이 없습니다.');
      }
      const results = await Promise.allSettled(
        relevantDaily.map((d: DailySettlement) =>
          adminFetch(`/api/admin/settlements/${d.id}/confirm`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0 && failed.length === results.length) {
        throw new Error('정산 확정에 실패했습니다. 이미 확정된 건이거나 권한이 없습니다.');
      }
      return { total: results.length, success: results.length - failed.length, failed: failed.length };
    },
    onSuccess: (result) => {
      toast({
        title: '정산 확정 완료',
        description: `총 ${result.total}건 중 ${result.success}건 확정 완료${result.failed > 0 ? ` (${result.failed}건 실패/이미처리됨)` : ''}`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/daily'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/helper'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || '정산 확정 실패', variant: 'error' });
    },
  });

  // 3. 세금계산서 발행 (요청자 정산 기반)
  const createTaxInvoiceMutation = useMutation({
    mutationFn: async (_requesterId: string) => {
      // 요청자의 해당 월 일정산 건들을 기반으로 세금계산서 생성
      const relevantDaily = dailySettlements.filter(
        (d: DailySettlement) => String(d.requesterName) === String(selectedRequester?.requesterName)
      );
      if (relevantDaily.length === 0) {
        throw new Error('세금계산서를 발행할 정산 건이 없습니다.');
      }
      // 첫 번째 건 기반으로 세금계산서 생성 (월 합산)
      const res = await adminFetch(`/api/admin/settlements/${relevantDaily[0].id}/create-tax-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType: 'forward' }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '세금계산서 생성 실패');
      }
      const data = await res.json();

      // 생성된 세금계산서를 바로 발행
      if (data.taxInvoice?.id) {
        const issueRes = await adminFetch(`/api/admin/tax-invoices/${data.taxInvoice.id}/issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!issueRes.ok) {
          return { ...data, issued: false, message: '세금계산서가 생성되었으나 발행은 실패했습니다. 수동으로 발행해주세요.' };
        }
        return { ...data, issued: true };
      }
      return data;
    },
    onSuccess: (result) => {
      toast({
        title: result.issued ? '세금계산서 발행 완료' : '세금계산서 생성 완료',
        description: result.issued
          ? '세금계산서가 성공적으로 발행되었습니다.'
          : result.message || '세금계산서가 생성되었습니다.',
        variant: 'success',
      });
    },
    onError: (err: any) => {
      toast({ title: err.message || '세금계산서 발행 실패', variant: 'error' });
    },
  });

  // 4. 입금 확인 (요청자 미수금 처리)
  const markPaidMutation = useMutation({
    mutationFn: async ({ form }: { requesterId: string; form: typeof paymentForm }) => {
      // 요청자의 해당 월 일정산 건들 중 미지급 건을 mark-paid 처리
      const relevantDaily = dailySettlements.filter(
        (d: DailySettlement) => String(d.requesterName) === String(selectedRequester?.requesterName)
      );
      if (relevantDaily.length === 0) {
        throw new Error('입금 처리할 정산 건이 없습니다.');
      }
      const results = await Promise.allSettled(
        relevantDaily.map((d: DailySettlement) =>
          adminFetch(`/api/admin/settlements/${d.id}/mark-paid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentMethod: form.paymentMethod,
              transactionId: form.transactionId || undefined,
              paidAmount: form.paidAmount ? Number(form.paidAmount) : undefined,
              notes: form.notes || undefined,
              confirmManualPayment: true,
            }),
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0 && failed.length === results.length) {
        throw new Error('입금 처리에 실패했습니다.');
      }
      return { total: results.length, success: results.length - failed.length, failed: failed.length };
    },
    onSuccess: (result) => {
      toast({
        title: '입금 확인 완료',
        description: `총 ${result.total}건 중 ${result.success}건 처리 완료`,
        variant: 'success',
      });
      setShowPaymentConfirm(false);
      setPaymentForm({ paymentMethod: 'bank_transfer', transactionId: '', paidAmount: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/requester'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/daily'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || '입금 확인 실패', variant: 'error' });
    },
  });

  // 5. 세금계산서 발행 (단건)
  const issueTaxInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const res = await adminFetch(`/api/admin/tax-invoices/${invoiceId}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '세금계산서 발행 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '세금계산서가 발행되었습니다.', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tax-invoices'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || '세금계산서 발행 실패', variant: 'error' });
    },
  });

  // 6. 세금계산서 PDF 다운로드
  const downloadTaxInvoicePdfMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const res = await adminFetch(`/api/admin/tax-invoices/${invoiceId}/popbill-pdf`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'PDF 다운로드 실패');
      }
      const data = await res.json();
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        throw new Error('PDF URL을 받지 못했습니다.');
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: 'PDF 다운로드 시작', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: err.message || 'PDF 다운로드 실패', variant: 'error' });
    },
  });

  // 7. 월 일괄 세금계산서 생성
  const generateMonthlyTaxInvoicesMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/api/admin/tax-invoices/generate-monthly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, month: selectedMonth + 1 }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '일괄 생성 실패');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: '월 일괄 세금계산서 생성 완료',
        description: `${data.created || 0}건 생성, ${data.skipped || 0}건 스킵`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tax-invoices'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || '일괄 생성 실패', variant: 'error' });
    },
  });

  // ============ 컬럼 정의 ============

  const dailyColumns: ColumnDef<DailySettlement>[] = [
    {
      key: 'orderId',
      header: '오더번호',
      width: 150,
      render: (value, row) => <span className="font-mono text-sm font-medium">{formatOrderNumber(row.orderNumber, value)}</span>,
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 100,
      render: (value) => value || '-',
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value || '-'}</div>
          {row.helperPhone && (
            <div className="text-xs text-muted-foreground">{row.helperPhone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: '카테고리',
      width: 90,
      render: (value) => (
        <Badge variant="outline">
          {CATEGORY_LABELS[value || ''] || value || '-'}
        </Badge>
      ),
    },
    {
      key: 'courierCompany',
      header: '운송사',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'deliveredCount',
      header: '배송',
      width: 60,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'returnedCount',
      header: '반품',
      width: 60,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'finalTotal',
      header: '최종금액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'platformFee',
      header: '수수료',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'driverPayout',
      header: '헬퍼지급액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium text-green-600">{formatAmount(value)}</span>,
    },
  ];

  const helperColumns: ColumnDef<HelperSettlement>[] = [
    {
      key: 'helperId',
      header: 'ID',
      width: 70,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'helperName',
      header: '헬퍼명',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted-foreground">{row.helperPhone}</div>
        </div>
      ),
    },
    {
      key: 'orderCount',
      header: '오더수',
      width: 70,
      align: 'center',
      render: (value) => <Badge variant="secondary">{value}건</Badge>,
    },
    {
      key: 'supplyPrice',
      header: '공급가',
      width: 110,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'vat',
      header: '부가세',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'totalAmount',
      header: '총액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'platformFee',
      header: '수수료',
      width: 100,
      align: 'right',
      render: (value) => <span className="text-sm text-red-600">-{formatAmount(value)}</span>,
    },
    {
      key: 'deductedAmount',
      header: '차감',
      width: 90,
      align: 'right',
      render: (value) => value > 0 ? (
        <span className="text-sm text-red-600">-{formatAmount(value)}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
    {
      key: 'driverPayout',
      header: '지급액',
      width: 120,
      align: 'right',
      render: (value) => <span className="font-bold text-green-600">{formatAmount(value)}</span>,
    },
  ];

  const requesterColumns: ColumnDef<RequesterSettlement>[] = [
    {
      key: 'requesterId',
      header: 'ID',
      width: 70,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'requesterName',
      header: '요청자명',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted-foreground">{row.businessName}</div>
        </div>
      ),
    },
    {
      key: 'requesterPhone',
      header: '연락처',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'orderCount',
      header: '오더수',
      width: 70,
      align: 'center',
      render: (value) => <Badge variant="secondary">{value}건</Badge>,
    },
    {
      key: 'billedAmount',
      header: '청구금액',
      width: 120,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'unpaidAmount',
      header: '미수금액',
      width: 120,
      align: 'right',
      render: (value) => value > 0 ? (
        <span className="font-medium text-orange-600">{formatAmount(value)}</span>
      ) : (
        <span className="text-sm text-green-600">완납</span>
      ),
    },
    {
      key: 'paymentDate',
      header: '입금일',
      width: 100,
      render: (value) => value ? (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
  ];

  const TAX_INVOICE_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: '작성중', variant: 'secondary' },
    issued: { label: '발행완료', variant: 'default' },
    sent: { label: '전송완료', variant: 'default' },
    failed: { label: '발행실패', variant: 'destructive' },
    cancelled: { label: '취소', variant: 'outline' },
  };

  const taxInvoiceColumns: ColumnDef<TaxInvoice>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 60,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'targetType',
      header: '구분',
      width: 80,
      render: (value) => (
        <Badge variant={value === 'helper' ? 'secondary' : 'outline'}>
          {value === 'helper' ? '헬퍼' : '요청자'}
        </Badge>
      ),
    },
    {
      key: 'targetName',
      header: '대상자',
      width: 130,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value || '-'}</div>
          {row.businessName && (
            <div className="text-xs text-muted-foreground">{row.businessName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'businessNumber',
      header: '사업자번호',
      width: 120,
      render: (value) => <span className="font-mono text-sm">{value || '-'}</span>,
    },
    {
      key: 'supplyAmount',
      header: '공급가액',
      width: 110,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'vatAmount',
      header: '부가세',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'totalAmount',
      header: '합계',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => {
        const info = TAX_INVOICE_STATUS_MAP[value] || { label: value, variant: 'outline' as const };
        return <Badge variant={info.variant}>{info.label}</Badge>;
      },
    },
    {
      key: 'issueDate',
      header: '발행일',
      width: 100,
      render: (value) => value ? (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
    {
      key: 'id' as any,
      header: '액션',
      width: 160,
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          {(row.status === 'issued' || row.status === 'sent') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => { e.stopPropagation(); downloadTaxInvoicePdfMutation.mutate(row.id); }}
              disabled={downloadTaxInvoicePdfMutation.isPending}
            >
              <Download className="h-3 w-3 mr-1" />
              PDF
            </Button>
          )}
          {row.status === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-blue-600"
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirm({ title: '세금계산서 발행', description: '이 세금계산서를 발행하시겠습니까?' })) {
                  issueTaxInvoiceMutation.mutate(row.id);
                }
              }}
              disabled={issueTaxInvoiceMutation.isPending}
            >
              <FileText className="h-3 w-3 mr-1" />
              발행
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ============ 렌더링 ============

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">💵 정산 관리</h1>
          <p className="text-muted-foreground">일정산, 헬퍼정산, 요청자정산, 세금계산서를 통합 관리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* 통합 카드 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-cols-4 w-[600px]">
                <TabsTrigger value="daily">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  일정산
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {dailyStats.count}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="helper">
                  <Users className="h-4 w-4 mr-2" />
                  헬퍼정산
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {helperStats.count}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="requester">
                  <Wallet className="h-4 w-4 mr-2" />
                  요청자정산
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {requesterStats.count}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="tax-invoices">
                  <Receipt className="h-4 w-4 mr-2" />
                  세금계산서
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {taxInvoiceStats.count}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* 검색 및 날짜 필터 */}
              <div className="flex items-center gap-2">
                {activeTab === 'daily' ? (
                  <DateRangePicker value={dailyDateRange} onChange={setDailyDateRange} />
                ) : (
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-6 w-6 p-0">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[80px] text-center">
                      {selectedYear}년 {monthNames[selectedMonth]}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-6 w-6 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={
                      activeTab === 'daily' 
                        ? '오더번호, 헬퍼, 요청자 검색...'
                        : activeTab === 'helper'
                        ? '헬퍼명, 연락처 검색...'
                        : '요청자명, 사업자명 검색...'
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* 일정산 탭 */}
            <TabsContent value="daily" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dailyStats.count}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 최종금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatAmount(dailyStats.totalFinal)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 수수료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatAmount(dailyStats.totalPlatformFee)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 헬퍼지급액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatAmount(dailyStats.totalDriverPayout)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={dailyColumns}
                data={filteredDailySettlements.slice((dailyPage - 1) * itemsPerPage, dailyPage * itemsPerPage)}
                onRowClick={(row) => setSelectedDailySettlement(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingDaily}
              />
              <Pagination
                currentPage={dailyPage}
                totalPages={Math.ceil(filteredDailySettlements.length / itemsPerPage) || 1}
                totalItems={filteredDailySettlements.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setDailyPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setDailyPage(1); }}
              />
            </TabsContent>

            {/* 헬퍼정산 탭 */}
            <TabsContent value="helper" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">헬퍼 수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{helperStats.count}명</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 오더</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{helperStats.totalOrders}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 수수료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatAmount(helperStats.totalPlatformFee)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 지급액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatAmount(helperStats.totalDriverPayout)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={helperColumns}
                data={filteredHelperSettlements.slice((helperPage - 1) * itemsPerPage, helperPage * itemsPerPage)}
                onRowClick={(row) => setSelectedHelper(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingHelper}
              />
              <Pagination
                currentPage={helperPage}
                totalPages={Math.ceil(filteredHelperSettlements.length / itemsPerPage) || 1}
                totalItems={filteredHelperSettlements.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setHelperPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setHelperPage(1); }}
              />
            </TabsContent>

            {/* 요청자정산 탭 */}
            <TabsContent value="requester" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">요청자 수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{requesterStats.count}명</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 오더</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{requesterStats.totalOrders}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 청구금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatAmount(requesterStats.totalBilled)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 미수금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{formatAmount(requesterStats.totalUnpaid)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={requesterColumns}
                data={filteredRequesterSettlements.slice((requesterPage - 1) * itemsPerPage, requesterPage * itemsPerPage)}
                onRowClick={(row) => setSelectedRequester(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingRequester}
              />
              <Pagination
                currentPage={requesterPage}
                totalPages={Math.ceil(filteredRequesterSettlements.length / itemsPerPage) || 1}
                totalItems={filteredRequesterSettlements.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setRequesterPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setRequesterPage(1); }}
              />
            </TabsContent>

            {/* 세금계산서 탭 */}
            <TabsContent value="tax-invoices" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{taxInvoiceStats.count}건</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      발행 {taxInvoiceStats.issuedCount} / 미발행 {taxInvoiceStats.draftCount}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 공급가액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatAmount(taxInvoiceStats.totalSupply)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 부가세</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatAmount(taxInvoiceStats.totalVat)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 합계금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatAmount(taxInvoiceStats.totalAmount)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 필터 & 액션 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Select value={taxInvoiceFilter} onValueChange={(v) => setTaxInvoiceFilter(v as any)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="helper">헬퍼</SelectItem>
                      <SelectItem value="requester">요청자</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (await confirm({ title: '세금계산서 일괄 생성', description: `${selectedYear}년 ${monthNames[selectedMonth]} 세금계산서를 일괄 생성하시겠습니까?` })) {
                      generateMonthlyTaxInvoicesMutation.mutate();
                    }
                  }}
                  disabled={generateMonthlyTaxInvoicesMutation.isPending}
                >
                  {generateMonthlyTaxInvoicesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  월 일괄 생성
                </Button>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={taxInvoiceColumns}
                data={filteredTaxInvoices.slice((taxInvoicePage - 1) * itemsPerPage, taxInvoicePage * itemsPerPage)}
                onRowClick={(row) => setSelectedTaxInvoice(row)}
                selectable={false}
                loading={loadingTaxInvoices}
              />
              <Pagination
                currentPage={taxInvoicePage}
                totalPages={Math.ceil(filteredTaxInvoices.length / itemsPerPage) || 1}
                totalItems={filteredTaxInvoices.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setTaxInvoicePage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setTaxInvoicePage(1); }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 세금계산서 상세 모달 */}
      <Dialog open={!!selectedTaxInvoice} onOpenChange={() => setSelectedTaxInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              세금계산서 상세 - #{selectedTaxInvoice?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedTaxInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">구분</div>
                  <div className="font-medium">
                    {selectedTaxInvoice.targetType === 'helper' ? '헬퍼' : '요청자'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">대상자</div>
                  <div className="font-medium">{selectedTaxInvoice.targetName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">사업자명</div>
                  <div className="font-medium">{selectedTaxInvoice.businessName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">사업자번호</div>
                  <div className="font-mono text-sm">{selectedTaxInvoice.businessNumber || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">귀속년월</div>
                  <div className="font-medium">{selectedTaxInvoice.year}년 {selectedTaxInvoice.month}월</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">상태</div>
                  <Badge variant={TAX_INVOICE_STATUS_MAP[selectedTaxInvoice.status]?.variant || 'outline'}>
                    {TAX_INVOICE_STATUS_MAP[selectedTaxInvoice.status]?.label || selectedTaxInvoice.status}
                  </Badge>
                </div>
              </div>

              <div className="border rounded-lg divide-y">
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">공급가액</span>
                  <span className="font-medium">{formatAmount(selectedTaxInvoice.supplyAmount)}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">부가세</span>
                  <span className="font-medium">{formatAmount(selectedTaxInvoice.vatAmount)}</span>
                </div>
                <div className="flex justify-between p-3 bg-blue-50">
                  <span className="font-semibold">합계금액</span>
                  <span className="font-bold text-blue-600">{formatAmount(selectedTaxInvoice.totalAmount)}</span>
                </div>
                {selectedTaxInvoice.issueDate && (
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">발행일</span>
                    <span className="font-medium">{new Date(selectedTaxInvoice.issueDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                  </div>
                )}
                {selectedTaxInvoice.popbillNtsConfirmNum && (
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">국세청 승인번호</span>
                    <span className="font-mono text-sm">{selectedTaxInvoice.popbillNtsConfirmNum}</span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedTaxInvoice(null)}>
                  닫기
                </Button>
                {(selectedTaxInvoice.status === 'issued' || selectedTaxInvoice.status === 'sent') && (
                  <Button
                    variant="outline"
                    onClick={() => downloadTaxInvoicePdfMutation.mutate(selectedTaxInvoice.id)}
                    disabled={downloadTaxInvoicePdfMutation.isPending}
                  >
                    {downloadTaxInvoicePdfMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    PDF 다운로드
                  </Button>
                )}
                {selectedTaxInvoice.status === 'draft' && (
                  <Button
                    onClick={async () => {
                      if (await confirm({ title: '세금계산서 발행', description: '이 세금계산서를 발행하시겠습니까?' })) {
                        issueTaxInvoiceMutation.mutate(selectedTaxInvoice.id);
                        setSelectedTaxInvoice(null);
                      }
                    }}
                    disabled={issueTaxInvoiceMutation.isPending}
                  >
                    {issueTaxInvoiceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4 mr-2" />
                    )}
                    세금계산서 발행
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 헬퍼 정산 상세 모달 — 거래명세표 형식 */}
      <Dialog open={!!selectedHelper} onOpenChange={() => setSelectedHelper(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          {selectedHelper && (
            <div className="divide-y">

              {/* ── 거래명세표 헤더 ── */}
              <div className="bg-slate-50 px-6 py-5">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold tracking-tight">거래명세표</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedYear}년 {monthNames[selectedMonth]} ({monthRange.from} ~ {monthRange.to})
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* 좌측: 공급자(본사) */}
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-2 tracking-wide">공급자</div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <span className="text-muted-foreground text-xs">상호</span>
                      <span className="font-medium">주식회사 본사</span>
                    </div>
                  </div>
                  {/* 우측: 공급받는자(헬퍼) */}
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-2 tracking-wide">공급받는자</div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <span className="text-muted-foreground text-xs">이름</span>
                      <span className="font-medium">
                        {selectedHelper.helperName}
                        {selectedHelper.helperEmail && (
                          <span className="text-muted-foreground font-normal text-xs ml-1">({selectedHelper.helperEmail})</span>
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs">연락처</span>
                      <span>{selectedHelper.helperPhone}</span>
                      <span className="text-muted-foreground text-xs">오더</span>
                      <span className="font-medium">{selectedHelper.orderCount}건</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 일정산 상세 테이블 ── */}
              <div className="px-6 py-4">
                {loadingOrders ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-y border-slate-300 text-slate-600">
                          <th className="px-2 py-2 text-left font-semibold">근무일</th>
                          <th className="px-2 py-2 text-left font-semibold">오더번호</th>
                          <th className="px-2 py-2 text-left font-semibold">요청자</th>
                          <th className="px-2 py-2 text-right font-semibold">공급가액</th>
                          <th className="px-2 py-2 text-right font-semibold">부가세</th>
                          <th className="px-2 py-2 text-right font-semibold">합계금</th>
                          <th className="px-2 py-2 text-right font-semibold">산재</th>
                          <th className="px-2 py-2 text-right font-semibold">차감</th>
                          <th className="px-2 py-2 text-right font-semibold">지급액</th>
                          <th className="px-1 py-2 text-center font-semibold w-14"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // 월 전체 날짜 배열 생성 (1일 ~ 말일)
                          const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                          const allDates: string[] = [];
                          for (let d = 1; d <= daysInMonth; d++) {
                            allDates.push(
                              `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                            );
                          }

                          // 오더를 날짜별 그룹핑
                          const ordersByDate = new Map<string, any[]>();
                          for (const order of orderDetails) {
                            const dateKey = order.date
                              ? new Date(order.date).toISOString().split('T')[0]
                              : '';
                            if (!ordersByDate.has(dateKey)) ordersByDate.set(dateKey, []);
                            ordersByDate.get(dateKey)!.push(order);
                          }

                          let globalRowIdx = 0;

                          return allDates.map((dateStr) => {
                            const dayOrders = ordersByDate.get(dateStr) || [];
                            const dayNum = parseInt(dateStr.split('-')[2], 10);
                            const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay(); // 0=일, 6=토
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                            const dayLabel = `${String(selectedMonth + 1).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;

                            if (dayOrders.length === 0) {
                              // 비근무일: 빈 행 표시
                              globalRowIdx++;
                              return (
                                <tr
                                  key={`empty-${dateStr}`}
                                  className={cn(
                                    "border-b border-slate-50",
                                    isWeekend ? "bg-red-50/30" : "bg-slate-50/30"
                                  )}
                                >
                                  <td className={cn(
                                    "px-2 py-1 whitespace-nowrap",
                                    isWeekend ? "text-red-300" : "text-muted-foreground/40"
                                  )}>
                                    {dayLabel}
                                  </td>
                                  <td className="px-2 py-1 text-muted-foreground/30 text-center" colSpan={8}>-</td>
                                  <td></td>
                                </tr>
                              );
                            }

                            // 해당 날짜에 오더가 있는 경우
                            return dayOrders.map((order: any, orderIdx: number) => {
                              const currentRowIdx = globalRowIdx++;
                              const isEditing = editingDeductions[order.orderId] !== undefined;
                              const isMemoEditing = editingMemos[order.orderId] !== undefined;
                              const deductionVal = isEditing ? editingDeductions[order.orderId] : (order.damageDeduction || 0);
                              const memoVal = isMemoEditing ? editingMemos[order.orderId] : (order.adminMemo || '');
                              const payoutVal = (order.totalAmount || 0) - (order.insurance || 0) - deductionVal;
                              const isExpanded = expandedOrderId === order.orderId;
                              const hasBreakdown = order.deductionBreakdown && order.deductionBreakdown.length > 0;
                              const rowBg = currentRowIdx % 2 === 0 ? '' : 'bg-slate-50/60';
                              return (
                                <React.Fragment key={order.orderId}>
                                  <tr
                                    className={cn("border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer", rowBg, isExpanded && "bg-blue-50/50")}
                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)}
                                  >
                                    <td className={cn("px-2 py-1.5 whitespace-nowrap", isWeekend && "text-red-500")}>
                                      {orderIdx === 0 ? dayLabel : ''}
                                    </td>
                                    <td className="px-2 py-1.5 font-mono">{order.orderId}</td>
                                    <td className="px-2 py-1.5 whitespace-nowrap">{order.requesterName || '-'}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{(order.supplyAmount || 0).toLocaleString()}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{(order.vatAmount || 0).toLocaleString()}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">{(order.totalAmount || 0).toLocaleString()}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-orange-600">{(order.insurance || 0).toLocaleString()}</td>
                                    <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                                      <Input
                                        type="number"
                                        value={deductionVal}
                                        onChange={(e) => handleDeductionChange(order.orderId, Number(e.target.value))}
                                        className="w-20 text-right h-6 text-xs px-1"
                                        min={0}
                                      />
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-emerald-600">
                                      {Math.max(0, payoutVal).toLocaleString()}
                                    </td>
                                    <td className="px-1 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                      {(isEditing || isMemoEditing) && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-800"
                                          onClick={() => handleSaveDeduction(order.orderId, selectedHelper.helperId)}
                                          disabled={savingDeduction === order.orderId}
                                        >
                                          {savingDeduction === order.orderId ? <Loader2 className="h-3 w-3 animate-spin" /> : '저장'}
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                  {/* ── 확장: 차감 상세 + 관리자 메모 ── */}
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={10} className="p-0">
                                        <div className="bg-slate-50 border-y border-slate-200 px-4 py-3 grid grid-cols-2 gap-4">
                                          {/* 좌: 차감 상세내역 */}
                                          <div>
                                            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">차감 상세내역</div>
                                            {hasBreakdown ? (
                                              <div className="space-y-1">
                                                {order.deductionBreakdown.map((item: any, idx: number) => (
                                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                                    <Badge variant={item.type === 'incident' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0 h-4">
                                                      {item.label}
                                                    </Badge>
                                                    <span className="text-red-600 font-medium tabular-nums">{(item.amount || 0).toLocaleString()}원</span>
                                                    {item.reason && <span className="text-muted-foreground truncate">- {item.reason}</span>}
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-xs text-muted-foreground italic">차감 내역 없음</p>
                                            )}
                                            {order.memo && (
                                              <div className="mt-2">
                                                <div className="text-[11px] font-semibold text-slate-500 mb-1">마감 메모</div>
                                                <p className="text-xs text-muted-foreground bg-white rounded p-1.5 border">{order.memo}</p>
                                              </div>
                                            )}
                                          </div>
                                          {/* 우: 관리자 메모 */}
                                          <div onClick={(e) => e.stopPropagation()}>
                                            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">관리자 메모</div>
                                            <Textarea
                                              value={memoVal}
                                              onChange={(e) => handleMemoChange(order.orderId, e.target.value)}
                                              placeholder="차감 사유, 조정 내용 등..."
                                              className="text-xs h-20 resize-none"
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            });
                          });
                        })()}
                        {/* ── 합계 행 ── */}
                        <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-xs">
                          <td className="px-2 py-2" colSpan={3}>합계 ({orderDetails.length}건)</td>
                          <td className="px-2 py-2 text-right tabular-nums">{(orderSummary?.totalSupply || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{(orderSummary?.totalVat || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-blue-700">{(orderSummary?.totalAmount || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-orange-600">{(orderSummary?.totalInsurance || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-red-600">{(orderSummary?.totalDamageDeduction || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                            {((orderSummary?.totalAmount || 0) - (orderSummary?.totalInsurance || 0) - (orderSummary?.totalDamageDeduction || 0)).toLocaleString()}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── 정산 내역 (앱 정산서와 동일 형식) ── */}
              <div className="px-6 py-4 space-y-1">
                <div className="text-sm font-semibold mb-2">정산 내역</div>
                <div className="border rounded-lg divide-y text-sm">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">총 금액 (공급가 + VAT)</span>
                    <span className="font-medium tabular-nums">{formatAmount(selectedHelper.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">플랫폼 수수료</span>
                    <span className="font-medium tabular-nums text-amber-500">-{formatAmount(selectedHelper.platformFee)}</span>
                  </div>
                  {orderSummary?.totalInsurance > 0 && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-muted-foreground">산재보험료 ({orderSummary.insuranceRate}% x 50%)</span>
                      <span className="font-medium tabular-nums text-orange-500">-{formatAmount(orderSummary.totalInsurance)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">기타 차감 (사고 등)</span>
                    <span className="font-medium tabular-nums text-red-500">-{formatAmount(selectedHelper.deductedAmount)}</span>
                  </div>
                  {selectedHelper.deductions > 0 && (
                    <div className="flex justify-between px-4 py-2 bg-muted/30">
                      <span className="text-muted-foreground text-xs pl-4">└ 분쟁 차감</span>
                      <span className="text-xs text-red-500 tabular-nums">-{formatAmount(selectedHelper.deductions)}</span>
                    </div>
                  )}
                  {selectedHelper.cargoIncident > 0 && (
                    <div className="flex justify-between px-4 py-2 bg-muted/30">
                      <span className="text-muted-foreground text-xs pl-4">└ 화물사고 배상</span>
                      <span className="text-xs text-red-500 tabular-nums">-{formatAmount(selectedHelper.cargoIncident)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-3 bg-emerald-50">
                    <span className="font-bold">최종 지급액</span>
                    <span className="font-bold text-lg text-emerald-600 tabular-nums">{formatAmount(selectedHelper.driverPayout)}</span>
                  </div>
                </div>
                {orderSummary?.insuranceRate && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    * 산재보험료: 특고직 기준 {orderSummary.insuranceRate}%, 본사 50%와 헬퍼 50% 분담
                  </p>
                )}
              </div>

              {/* ── 하단 버튼 ── */}
              <div className="px-6 py-4 flex justify-between items-center bg-slate-50">
                <Button variant="ghost" size="sm" onClick={() => setSelectedHelper(null)}>
                  닫기
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadStatement(selectedHelper)}>
                    <FileText className="h-4 w-4 mr-1.5" />
                    거래명세서
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (await confirm({ title: '정산 확정', description: `${selectedHelper.helperName} 헬퍼의 ${selectedYear}년 ${monthNames[selectedMonth]} 정산을 확정하시겠습니까?` })) {
                        confirmSettlementMutation.mutate(selectedHelper.helperId);
                      }
                    }}
                    disabled={confirmSettlementMutation.isPending}
                  >
                    {confirmSettlementMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1.5" />
                    )}
                    정산 확정
                  </Button>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 입금 확인 모달 */}
      <Dialog open={showPaymentConfirm} onOpenChange={setShowPaymentConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>입금 확인 처리</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequester && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="font-medium">{selectedRequester.requesterName} ({selectedRequester.businessName})</div>
                <div className="text-muted-foreground mt-1">
                  미수금액: <span className="font-medium text-orange-600">{formatAmount(selectedRequester.unpaidAmount)}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>결제 방법</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">계좌이체</SelectItem>
                  <SelectItem value="card">카드결제</SelectItem>
                  <SelectItem value="cash">현금</SelectItem>
                  <SelectItem value="virtual_account">가상계좌</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>거래 번호 (선택)</Label>
              <Input
                placeholder="입금 거래 번호"
                value={paymentForm.transactionId}
                onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>입금 금액</Label>
              <Input
                type="number"
                placeholder="입금 금액"
                value={paymentForm.paidAmount}
                onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea
                placeholder="입금 관련 메모"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentConfirm(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (selectedRequester) {
                  markPaidMutation.mutate({
                    requesterId: selectedRequester.requesterId,
                    form: paymentForm,
                  });
                }
              }}
              disabled={markPaidMutation.isPending || !paymentForm.paidAmount}
            >
              {markPaidMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              입금 확인 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 요청자 정산 상세 모달 — 거래명세표 형식 */}
      <Dialog open={!!selectedRequester} onOpenChange={() => setSelectedRequester(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          {selectedRequester && (
            <div className="divide-y">

              {/* ── 거래명세표 헤더 ── */}
              <div className="bg-slate-50 px-6 py-5">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold tracking-tight">거래명세표</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedYear}년 {monthNames[selectedMonth]} ({monthRange.from} ~ {monthRange.to})
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* 좌측: 공급자(본사) */}
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-2 tracking-wide">공급자</div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <span className="text-muted-foreground text-xs">상호</span>
                      <span className="font-medium">주식회사 본사</span>
                    </div>
                  </div>
                  {/* 우측: 공급받는자(요청자) */}
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-2 tracking-wide">공급받는자</div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <span className="text-muted-foreground text-xs">이름</span>
                      <span className="font-medium">
                        {selectedRequester.requesterName}
                        {selectedRequester.requesterEmail && (
                          <span className="text-muted-foreground font-normal text-xs ml-1">({selectedRequester.requesterEmail})</span>
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs">사업자</span>
                      <span>{selectedRequester.businessName || '-'}</span>
                      <span className="text-muted-foreground text-xs">연락처</span>
                      <span>{selectedRequester.requesterPhone}</span>
                      <span className="text-muted-foreground text-xs">오더</span>
                      <span className="font-medium">{selectedRequester.orderCount}건</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 일정산 상세 테이블 ── */}
              <div className="px-6 py-4">
                {loadingRequesterOrders ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-y border-slate-300 text-slate-600">
                          <th className="px-2 py-2 text-left font-semibold">근무일</th>
                          <th className="px-2 py-2 text-left font-semibold">오더번호</th>
                          <th className="px-2 py-2 text-left font-semibold">헬퍼</th>
                          <th className="px-2 py-2 text-right font-semibold">공급가액</th>
                          <th className="px-2 py-2 text-right font-semibold">부가세</th>
                          <th className="px-2 py-2 text-right font-semibold">합계금</th>
                          <th className="px-2 py-2 text-right font-semibold">계약금</th>
                          <th className="px-2 py-2 text-right font-semibold">잔금</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // 월 전체 날짜 배열 생성 (1일 ~ 말일)
                          const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                          const allDates: string[] = [];
                          for (let d = 1; d <= daysInMonth; d++) {
                            allDates.push(
                              `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                            );
                          }

                          // 오더를 날짜별 그룹핑
                          const ordersByDate = new Map<string, any[]>();
                          for (const order of requesterOrderDetails) {
                            const dateKey = order.orderDate
                              ? new Date(order.orderDate).toISOString().split('T')[0]
                              : '';
                            if (!ordersByDate.has(dateKey)) ordersByDate.set(dateKey, []);
                            ordersByDate.get(dateKey)!.push(order);
                          }

                          let globalRowIdx = 0;

                          return allDates.map((dateStr) => {
                            const dayOrders = ordersByDate.get(dateStr) || [];
                            const dayNum = parseInt(dateStr.split('-')[2], 10);
                            const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                            const dayLabel = `${String(selectedMonth + 1).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;

                            if (dayOrders.length === 0) {
                              globalRowIdx++;
                              return (
                                <tr
                                  key={`empty-${dateStr}`}
                                  className={cn(
                                    "border-b border-slate-50",
                                    isWeekend ? "bg-red-50/30" : "bg-slate-50/30"
                                  )}
                                >
                                  <td className={cn(
                                    "px-2 py-1 whitespace-nowrap",
                                    isWeekend ? "text-red-300" : "text-muted-foreground/40"
                                  )}>
                                    {dayLabel}
                                  </td>
                                  <td className="px-2 py-1 text-muted-foreground/30 text-center" colSpan={7}>-</td>
                                </tr>
                              );
                            }

                            return dayOrders.map((order: any, orderIdx: number) => {
                              const currentRowIdx = globalRowIdx++;
                              const rowBg = currentRowIdx % 2 === 0 ? '' : 'bg-slate-50/60';
                              return (
                                <tr
                                  key={order.orderId}
                                  className={cn("border-b border-slate-100 hover:bg-blue-50/40", rowBg)}
                                >
                                  <td className={cn("px-2 py-1.5 whitespace-nowrap", isWeekend && "text-red-500")}>
                                    {orderIdx === 0 ? dayLabel : ''}
                                  </td>
                                  <td className="px-2 py-1.5 font-mono">{order.orderId}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{order.helperName || '-'}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{(order.supplyAmount || 0).toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{(order.vatAmount || 0).toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{(order.totalAmount || 0).toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{(order.depositAmount || 0).toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-orange-600">{(order.balanceAmount || 0).toLocaleString()}</td>
                                </tr>
                              );
                            });
                          });
                        })()}
                        {/* ── 합계 행 ── */}
                        <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-xs">
                          <td className="px-2 py-2" colSpan={3}>합계 ({requesterOrderDetails.length}건)</td>
                          <td className="px-2 py-2 text-right tabular-nums">{(requesterOrderSummary?.totalSupply || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{(requesterOrderSummary?.totalVat || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-blue-700">{(requesterOrderSummary?.totalAmount || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-emerald-600">{(requesterOrderSummary?.totalDeposit || 0).toLocaleString()}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-orange-600">{(requesterOrderSummary?.totalBalance || 0).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── 청구 내역 ── */}
              <div className="px-6 py-4 space-y-1">
                <div className="text-sm font-semibold mb-2">청구 내역</div>
                <div className="border rounded-lg divide-y text-sm">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">총 청구금액 (공급가 + VAT)</span>
                    <span className="font-medium tabular-nums">{formatAmount(selectedRequester.billedAmount)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">계약금 합계</span>
                    <span className="font-medium tabular-nums text-emerald-600">{formatAmount(requesterOrderSummary?.totalDeposit)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-orange-50">
                    <span className="font-bold">미수금액 (잔금 합계)</span>
                    <span className="font-bold text-lg text-orange-600 tabular-nums">{formatAmount(selectedRequester.unpaidAmount)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">입금 예정일</span>
                    <span className="font-medium">
                      {selectedRequester.paymentDate ? new Date(selectedRequester.paymentDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미정'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── 미수금 안내 ── */}
              {selectedRequester.unpaidAmount > 0 && (
                <div className="px-6 pb-2">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-orange-900">미수금 확인 필요</div>
                        <div className="text-sm text-orange-700 mt-1">
                          {formatAmount(selectedRequester.unpaidAmount)}의 미수금이 있습니다.
                          입금 확인 후 정산을 완료해주세요.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 하단 버튼 ── */}
              <div className="px-6 py-4 flex justify-between items-center bg-slate-50">
                <Button variant="ghost" size="sm" onClick={() => setSelectedRequester(null)}>
                  닫기
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (await confirm({ title: '세금계산서 발행', description: `${selectedRequester.requesterName}님의 세금계산서를 발행하시겠습니까?` })) {
                        createTaxInvoiceMutation.mutate(selectedRequester.requesterId);
                      }
                    }}
                    disabled={createTaxInvoiceMutation.isPending}
                  >
                    {createTaxInvoiceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4 mr-1.5" />
                    )}
                    세금계산서 발행
                  </Button>
                  {selectedRequester.unpaidAmount > 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPaymentForm({
                          ...paymentForm,
                          paidAmount: String(selectedRequester.unpaidAmount),
                        });
                        setShowPaymentConfirm(true);
                      }}
                    >
                      <CreditCard className="h-4 w-4 mr-1.5" />
                      입금 확인
                    </Button>
                  )}
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 일일 정산 상세 모달 */}
      <Dialog open={!!selectedDailySettlement} onOpenChange={() => setSelectedDailySettlement(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>일일 정산 상세</DialogTitle>
          </DialogHeader>
          {selectedDailySettlement && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">오더번호</div>
                  <div className="font-medium">#{selectedDailySettlement.orderId}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">정산 ID</div>
                  <div className="font-mono text-sm">#{selectedDailySettlement.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">헬퍼</div>
                  <div>
                    <div className="font-medium">{selectedDailySettlement.helperName || '-'}</div>
                    {selectedDailySettlement.helperPhone && (
                      <div className="text-xs text-muted-foreground">{selectedDailySettlement.helperPhone}</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">요청자</div>
                  <div className="font-medium">{selectedDailySettlement.requesterName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">카테고리</div>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedDailySettlement.category || ''] || selectedDailySettlement.category || '-'}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">운송사</div>
                  <div className="font-medium">{selectedDailySettlement.courierCompany || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">정산일</div>
                  <div className="font-medium">{new Date(selectedDailySettlement.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
                </div>
              </div>

              {/* 배송 수량 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">배송 수량</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">배송 완료</span>
                    <span className="font-medium">{selectedDailySettlement.deliveredCount}건</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">반품</span>
                    <span className="font-medium">{selectedDailySettlement.returnedCount}건</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">기타</span>
                    <span className="font-medium">{selectedDailySettlement.etcCount}건</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">건당 단가</span>
                    <span className="font-medium">{formatAmount(selectedDailySettlement.pricePerBox)}</span>
                  </div>
                </div>
              </div>

              {/* 추가 비용 */}
              {selectedDailySettlement.extraCostsJson && selectedDailySettlement.extraCostsJson.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">추가 비용</h3>
                  <div className="border rounded-lg divide-y">
                    {selectedDailySettlement.extraCostsJson.map((item, idx) => (
                      <div key={idx} className="flex justify-between p-3 hover:bg-muted/50">
                        <span className="text-muted-foreground">{item.name} (x{item.quantity})</span>
                        <span className="font-medium">{formatAmount(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 정산 내역 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">정산 내역</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3 hover:bg-muted/50 bg-blue-50">
                    <span className="font-semibold">최종 금액</span>
                    <span className="font-bold text-blue-600">{formatAmount(selectedDailySettlement.finalTotal)}</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">플랫폼 수수료</span>
                    <span className="font-medium text-red-600">-{formatAmount(selectedDailySettlement.platformFee)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50">
                    <span className="font-bold">헬퍼 지급액</span>
                    <span className="font-bold text-xl text-green-600">{formatAmount(selectedDailySettlement.driverPayout)}</span>
                  </div>
                </div>
              </div>

              {/* 마감 메모 */}
              {selectedDailySettlement.closingMemo && (
                <div>
                  <p className="text-sm text-muted-foreground">마감 메모</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{selectedDailySettlement.closingMemo}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDailySettlement(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
