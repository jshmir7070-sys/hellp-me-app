# 관리자 시스템 재설계 구현 가이드

**목표**: 제안된 실전 사용성 중심 관리자 시스템 구현
**예상 기간**: 2주
**우선순위**: 높음 (즉시 시작 권장)

---

## 📊 현재 상태 vs 목표 상태

### ❌ **현재 (Before)**
```
관리자가 오더 1건 처리하는 과정:
1. Orders 메뉴 클릭
2. 필터 선택 (승인 대기)
3. 오더 클릭 (상세 보기)
4. 승인 버튼 클릭
5. Payments 메뉴로 이동
6. 결제 상태 확인
7. Settlements 메뉴로 이동
8. 정산 정보 확인

총 8단계, 3개 메뉴 이동, 약 5분 소요
```

### ✅ **목표 (After)**
```
관리자가 오더 1건 처리하는 과정:
1. 업무 대기함 메뉴 클릭
2. 체크박스 선택
3. "선택 항목 승인" 버튼 클릭

총 3단계, 메뉴 이동 없음, 약 30초 소요
⏱️ 시간 절감: 90%
```

---

## 🎯 Phase 1: 업무 대기함 구현 (3일)

### Day 1: 데이터베이스 뷰 생성

#### 1.1 통합 오더 뷰
```typescript
// server/db/schema/views.ts

import { pgView, sql } from 'drizzle-orm/pg-core';
import { orders, users, settlements, contracts } from './schema';

/**
 * 관리자용 통합 오더 뷰
 * - 오더, 사용자, 결제, 정산 정보를 한 번에
 */
export const adminOrdersView = pgView('admin_orders_view', {
  // 오더 기본
  id: orders.id,
  status: orders.status,
  isUrgent: orders.isUrgent,
  createdAt: orders.createdAt,
  statusUpdatedAt: orders.statusUpdatedAt,

  // 요청자
  requesterId: orders.requesterId,
  requesterName: sql<string>`requester.name`.as('requester_name'),
  requesterCompany: sql<string>`requester.company`.as('requester_company'),
  requesterAvatar: sql<string>`requester.avatar`.as('requester_avatar'),

  // 헬퍼
  helperId: orders.helperId,
  helperName: sql<string>`helper.name`.as('helper_name'),
  helperRating: sql<number>`helper.rating`.as('helper_rating'),
  helperAvatar: sql<string>`helper.avatar`.as('helper_avatar'),

  // 구간
  pickup: orders.pickup,
  delivery: orders.delivery,

  // 금액
  totalAmount: orders.totalAmount,
  depositPaid: orders.depositPaid,
  balancePaid: orders.balancePaid,

  // 정산
  settlementId: sql<number>`s.id`.as('settlement_id'),
  settlementStatus: sql<string>`s.status`.as('settlement_status'),
  settlementAmount: sql<number>`s.payout_amount`.as('settlement_amount'),
}).as(sql`
  SELECT
    o.id,
    o.status,
    o.is_urgent,
    o.created_at,
    o.status_updated_at,
    o.requester_id,
    requester.name as requester_name,
    requester.company as requester_company,
    requester.avatar as requester_avatar,
    o.helper_id,
    helper.name as helper_name,
    helper.rating as helper_rating,
    helper.avatar as helper_avatar,
    o.pickup,
    o.delivery,
    o.total_amount,
    o.deposit_paid,
    o.balance_paid,
    s.id as settlement_id,
    s.status as settlement_status,
    s.payout_amount as settlement_amount
  FROM orders o
  LEFT JOIN users requester ON o.requester_id = requester.id
  LEFT JOIN users helper ON o.helper_id = helper.id
  LEFT JOIN settlements s ON o.id = s.order_id
`);

/**
 * 작업 대기함 뷰
 * - 승인/처리가 필요한 항목들만
 */
export const taskQueueView = pgView('task_queue_view', {
  taskType: sql<string>`task_type`,
  referenceId: sql<number>`reference_id`,
  priority: sql<number>`priority`,
  waitingMinutes: sql<number>`waiting_minutes`,
  relatedData: sql<any>`related_data`,
}).as(sql`
  SELECT
    'order_approval' as task_type,
    o.id as reference_id,
    CASE WHEN o.is_urgent THEN 1 ELSE 3 END as priority,
    EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 as waiting_minutes,
    json_build_object(
      'orderId', o.id,
      'requesterName', u.name,
      'pickup', o.pickup,
      'delivery', o.delivery,
      'amount', o.total_amount
    ) as related_data
  FROM orders o
  LEFT JOIN users u ON o.requester_id = u.id
  WHERE o.status = 'pending'

  UNION ALL

  SELECT
    'settlement_approval' as task_type,
    s.id as reference_id,
    CASE WHEN s.payout_amount > 500000 THEN 2 ELSE 3 END as priority,
    EXTRACT(EPOCH FROM (NOW() - s.submitted_at)) / 60 as waiting_minutes,
    json_build_object(
      'settlementId', s.id,
      'orderId', s.order_id,
      'helperName', h.name,
      'amount', s.payout_amount
    ) as related_data
  FROM settlements s
  LEFT JOIN users h ON s.helper_id = h.id
  WHERE s.status = 'pending'

  UNION ALL

  SELECT
    'helper_verification' as task_type,
    iv.id as reference_id,
    2 as priority,
    EXTRACT(EPOCH FROM (NOW() - iv.submitted_at)) / 60 as waiting_minutes,
    json_build_object(
      'userId', iv.user_id,
      'name', u.name,
      'verificationType', iv.verification_type
    ) as related_data
  FROM identity_verifications iv
  LEFT JOIN users u ON iv.user_id = u.id
  WHERE iv.status = 'submitted'

  ORDER BY priority ASC, waiting_minutes DESC
`);
```

#### 1.2 마이그레이션 실행
```bash
# Drizzle 스키마 업데이트
cd server
npx drizzle-kit generate
npx drizzle-kit push

# 뷰 확인
psql -d hellpme -c "SELECT * FROM admin_orders_view LIMIT 5;"
psql -d hellpme -c "SELECT * FROM task_queue_view LIMIT 10;"
```

---

### Day 2: API 엔드포인트 생성

#### 2.1 통합 대시보드 API
```typescript
// server/routes/admin/dashboard.routes.ts

import { Router } from 'express';
import { adminAuth } from '../../utils/auth-middleware';
import { db } from '../../db';
import { adminOrdersView, taskQueueView } from '../../db/schema/views';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/admin/dashboard/overview
 * 대시보드 전체 데이터 (한 번에)
 */
router.get('/overview', adminAuth, async (req, res) => {
  try {
    const [stats, taskQueue, recentOrders] = await Promise.all([
      // 통계 데이터
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('in_progress', 'scheduled')) as active_orders,
          COUNT(DISTINCT helper_id) FILTER (WHERE status = 'in_progress') as active_helpers,
          COALESCE(SUM(settlement_amount) FILTER (WHERE settlement_status = 'pending'), 0) as pending_settlement,
          COALESCE(SUM(total_amount * 0.15) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) as today_revenue
        FROM admin_orders_view
      `),

      // 작업 대기함 (상위 20개)
      db.select().from(taskQueueView).limit(20),

      // 최근 오더 (상위 10개)
      db.select()
        .from(adminOrdersView)
        .orderBy(sql`created_at DESC`)
        .limit(10),
    ]);

    res.json({
      stats: stats.rows[0],
      taskQueue,
      recentOrders,
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/admin/task-queue
 * 업무 대기함 (필터링 가능)
 */
router.get('/task-queue', adminAuth, async (req, res) => {
  const { type, priority } = req.query;

  try {
    let query = db.select().from(taskQueueView);

    if (type) {
      query = query.where(sql`task_type = ${type}`);
    }

    if (priority) {
      query = query.where(sql`priority = ${priority}`);
    }

    const tasks = await query;

    // 타입별로 그룹화
    const grouped = {
      orderApproval: tasks.filter(t => t.taskType === 'order_approval'),
      settlementApproval: tasks.filter(t => t.taskType === 'settlement_approval'),
      helperVerification: tasks.filter(t => t.taskType === 'helper_verification'),
    };

    res.json(grouped);
  } catch (error) {
    console.error('Task queue error:', error);
    res.status(500).json({ error: 'Failed to fetch task queue' });
  }
});

export default router;
```

#### 2.2 일괄 처리 API
```typescript
// server/routes/admin/batch.routes.ts

import { Router } from 'express';
import { adminAuth } from '../../utils/auth-middleware';
import { db } from '../../db';
import { orders, settlements, auditLogs } from '../../db/schema';
import { inArray, eq, and } from 'drizzle-orm';
import { broadcastOrderUpdate } from '../../websocket/admin-socket';

const router = Router();

/**
 * POST /api/admin/batch/approve-orders
 * 오더 일괄 승인
 */
router.post('/approve-orders', adminAuth, async (req, res) => {
  const { orderIds } = req.body;
  const adminId = req.user!.id;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ error: 'orderIds array required' });
  }

  try {
    await db.transaction(async (tx) => {
      // 1. 오더 상태 업데이트
      await tx
        .update(orders)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: adminId,
          statusUpdatedAt: new Date(),
        })
        .where(
          and(
            inArray(orders.id, orderIds),
            eq(orders.status, 'pending')
          )
        );

      // 2. 감사 로그 기록
      await tx.insert(auditLogs).values(
        orderIds.map(orderId => ({
          orderId,
          action: 'batch_approve',
          actorId: adminId,
          actorType: 'admin',
          changes: JSON.stringify({
            from: 'pending',
            to: 'approved'
          }),
          performedAt: new Date(),
        }))
      );
    });

    // 3. 실시간 알림 전송
    orderIds.forEach(orderId => {
      broadcastOrderUpdate({
        orderId,
        status: 'approved',
        message: '오더가 승인되었습니다',
        timestamp: new Date(),
      });
    });

    res.json({
      success: true,
      approvedCount: orderIds.length
    });
  } catch (error) {
    console.error('Batch approve error:', error);
    res.status(500).json({ error: 'Failed to approve orders' });
  }
});

/**
 * POST /api/admin/batch/approve-settlements
 * 정산 일괄 승인
 */
router.post('/approve-settlements', adminAuth, async (req, res) => {
  const { settlementIds } = req.body;
  const adminId = req.user!.id;

  if (!Array.isArray(settlementIds) || settlementIds.length === 0) {
    return res.status(400).json({ error: 'settlementIds array required' });
  }

  try {
    await db.transaction(async (tx) => {
      // 1. 정산 상태 업데이트
      await tx
        .update(settlements)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: adminId,
          // 다음 금요일로 지급일 설정
          scheduledPayoutDate: getNextFriday(),
        })
        .where(
          and(
            inArray(settlements.id, settlementIds),
            eq(settlements.status, 'pending')
          )
        );

      // 2. 감사 로그
      await tx.insert(auditLogs).values(
        settlementIds.map(settlementId => ({
          settlementId,
          action: 'batch_approve_settlement',
          actorId: adminId,
          actorType: 'admin',
          changes: JSON.stringify({
            from: 'pending',
            to: 'approved'
          }),
          performedAt: new Date(),
        }))
      );
    });

    res.json({
      success: true,
      approvedCount: settlementIds.length,
      payoutDate: getNextFriday(),
    });
  } catch (error) {
    console.error('Batch approve settlements error:', error);
    res.status(500).json({ error: 'Failed to approve settlements' });
  }
});

// 다음 금요일 계산
function getNextFriday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);
  nextFriday.setHours(14, 0, 0, 0); // 오후 2시
  return nextFriday;
}

export default router;
```

---

### Day 3: 프론트엔드 - 업무 대기함 페이지

#### 3.1 업무 대기함 페이지
```typescript
// admin/src/pages/TaskQueuePage.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Package,
  DollarSign,
  CreditCard,
  UserCheck,
  Check,
  Eye,
} from 'lucide-react';

interface TaskQueue {
  orderApproval: any[];
  settlementApproval: any[];
  helperVerification: any[];
}

export default function TaskQueuePage() {
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [selectedSettlements, setSelectedSettlements] = useState<number[]>([]);

  // 작업 대기함 데이터 (5초마다 자동 갱신)
  const { data: taskQueue, isLoading } = useQuery<TaskQueue>({
    queryKey: ['admin', 'task-queue'],
    queryFn: async () => {
      const res = await fetch('/api/admin/task-queue', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch task queue');
      return res.json();
    },
    refetchInterval: 5000, // 5초마다 자동 갱신
  });

  // 오더 일괄 승인 Mutation
  const approveOrdersMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const res = await fetch('/api/admin/batch/approve-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ orderIds }),
      });
      if (!res.ok) throw new Error('Failed to approve orders');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: '승인 완료',
        description: `${data.approvedCount}건의 오더가 승인되었습니다`,
      });
      setSelectedOrders([]);
      queryClient.invalidateQueries(['admin', 'task-queue']);
    },
    onError: () => {
      toast({
        title: '승인 실패',
        description: '오더 승인 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    },
  });

  // 정산 일괄 승인 Mutation
  const approveSettlementsMutation = useMutation({
    mutationFn: async (settlementIds: number[]) => {
      const res = await fetch('/api/admin/batch/approve-settlements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ settlementIds }),
      });
      if (!res.ok) throw new Error('Failed to approve settlements');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: '정산 승인 완료',
        description: `${data.approvedCount}건 승인, 지급일: ${data.payoutDate}`,
      });
      setSelectedSettlements([]);
      queryClient.invalidateQueries(['admin', 'task-queue']);
    },
  });

  // 전체 선택/해제
  const toggleSelectAll = (items: any[], selected: number[], setter: (ids: number[]) => void) => {
    if (selected.length === items.length) {
      setter([]);
    } else {
      setter(items.map(item => item.relatedData.orderId || item.relatedData.settlementId));
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">업무 대기함</h1>
        <p className="text-gray-500 text-sm">오늘 처리해야 할 작업을 확인하세요</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">오더 승인 대기</div>
                <div className="text-2xl font-bold">
                  {taskQueue?.orderApproval?.length || 0}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">정산 승인 대기</div>
                <div className="text-2xl font-bold">
                  {taskQueue?.settlementApproval?.length || 0}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">헬퍼 인증 대기</div>
                <div className="text-2xl font-bold">
                  {taskQueue?.helperVerification?.length || 0}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">총 대기 작업</div>
                <div className="text-2xl font-bold">
                  {(taskQueue?.orderApproval?.length || 0) +
                   (taskQueue?.settlementApproval?.length || 0) +
                   (taskQueue?.helperVerification?.length || 0)}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">
            오더 승인 ({taskQueue?.orderApproval?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="settlements">
            정산 승인 ({taskQueue?.settlementApproval?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="helpers">
            헬퍼 인증 ({taskQueue?.helperVerification?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* 오더 승인 탭 */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>오더 승인 대기</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSelectAll(
                      taskQueue?.orderApproval || [],
                      selectedOrders,
                      setSelectedOrders
                    )}
                  >
                    {selectedOrders.length === taskQueue?.orderApproval?.length
                      ? '전체 해제'
                      : '전체 선택'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedOrders.length === 0 || approveOrdersMutation.isPending}
                    onClick={() => approveOrdersMutation.mutate(selectedOrders)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    선택 항목 승인 ({selectedOrders.length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>오더</TableHead>
                    <TableHead>요청자</TableHead>
                    <TableHead>구간</TableHead>
                    <TableHead>금액</TableHead>
                    <TableHead>대기 시간</TableHead>
                    <TableHead>액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskQueue?.orderApproval?.map((task) => {
                    const data = task.relatedData;
                    return (
                      <TableRow key={data.orderId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(data.orderId)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedOrders([...selectedOrders, data.orderId]);
                              } else {
                                setSelectedOrders(selectedOrders.filter(id => id !== data.orderId));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {task.priority === 1 && (
                              <Badge variant="destructive" className="text-xs">
                                긴급
                              </Badge>
                            )}
                            <span className="font-mono">#{data.orderId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{data.requesterName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-xs truncate">
                            {data.pickup} → {data.delivery}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            ₩{data.amount.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-500">
                            {Math.round(task.waitingMinutes)}분 전
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approveOrdersMutation.mutate([data.orderId])}
                            >
                              승인
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.location.href = `/orders/${data.orderId}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 정산 승인 탭 */}
        <TabsContent value="settlements">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>정산 승인 대기</CardTitle>
                <div className="flex gap-2">
                  <div className="text-sm text-gray-500 mr-4">
                    총 지급액: ₩{taskQueue?.settlementApproval
                      ?.reduce((sum, t) => sum + t.relatedData.amount, 0)
                      .toLocaleString()}
                  </div>
                  <Button
                    size="sm"
                    disabled={selectedSettlements.length === 0 || approveSettlementsMutation.isPending}
                    onClick={() => approveSettlementsMutation.mutate(selectedSettlements)}
                  >
                    선택 항목 승인 ({selectedSettlements.length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>헬퍼</TableHead>
                    <TableHead>오더</TableHead>
                    <TableHead>지급액</TableHead>
                    <TableHead>대기 시간</TableHead>
                    <TableHead>액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskQueue?.settlementApproval?.map((task) => {
                    const data = task.relatedData;
                    return (
                      <TableRow key={data.settlementId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSettlements.includes(data.settlementId)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSettlements([...selectedSettlements, data.settlementId]);
                              } else {
                                setSelectedSettlements(selectedSettlements.filter(id => id !== data.settlementId));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{data.helperName}</div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">#{data.orderId}</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-green-600">
                            ₩{data.amount.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-500">
                            {Math.round(task.waitingMinutes)}분 전
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => approveSettlementsMutation.mutate([data.settlementId])}
                          >
                            승인
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 🎯 Phase 2: 실시간 업데이트 구현 (2일)

### WebSocket 서버
```typescript
// server/websocket/admin-realtime.ts

import { WebSocketServer, WebSocket } from 'ws';

// 관리자 연결 관리
const adminConnections = new Map<string, WebSocket>();

export function initAdminWebSocket(server: any) {
  const wss = new WebSocketServer({
    server,
    path: '/admin-ws'
  });

  wss.on('connection', (ws: WebSocket, req: any) => {
    const adminId = new URL(req.url, 'http://localhost').searchParams.get('adminId');

    if (!adminId) {
      ws.close(1008, 'Missing adminId');
      return;
    }

    adminConnections.set(adminId, ws);
    console.log(`[WebSocket] Admin ${adminId} connected`);

    // Heartbeat
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(interval);
      adminConnections.delete(adminId);
      console.log(`[WebSocket] Admin ${adminId} disconnected`);
    });
  });

  return wss;
}

// 오더 업데이트 브로드캐스트
export function broadcastOrderUpdate(update: any) {
  const message = JSON.stringify({
    type: 'ORDER_UPDATE',
    data: update,
    timestamp: new Date().toISOString(),
  });

  adminConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// 새로운 작업 알림
export function notifyNewTask(task: any) {
  const message = JSON.stringify({
    type: 'NEW_TASK',
    data: task,
    timestamp: new Date().toISOString(),
  });

  adminConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
```

---

## 📋 구현 체크리스트

### Week 1
- [ ] Day 1: DB 뷰 생성
  - [ ] admin_orders_view
  - [ ] task_queue_view
  - [ ] 마이그레이션 실행

- [ ] Day 2: API 엔드포인트
  - [ ] /api/admin/dashboard/overview
  - [ ] /api/admin/task-queue
  - [ ] /api/admin/batch/approve-orders
  - [ ] /api/admin/batch/approve-settlements

- [ ] Day 3: 업무 대기함 페이지
  - [ ] TaskQueuePage.tsx
  - [ ] 요약 카드
  - [ ] 오더 승인 탭
  - [ ] 정산 승인 탭

- [ ] Day 4-5: 실시간 업데이트
  - [ ] WebSocket 서버
  - [ ] 클라이언트 연동
  - [ ] 자동 갱신 (5초)

### Week 2
- [ ] Day 1-2: 통합 오더 상세
  - [ ] 3단 레이아웃
  - [ ] 실시간 위치 추적
  - [ ] 마감 보고서 뷰어

- [ ] Day 3-4: 통합 오더 관리
  - [ ] 상태별 필터
  - [ ] 통합 테이블
  - [ ] 액션 메뉴

- [ ] Day 5: 테스트 & 최적화
  - [ ] API 응답 시간 측정
  - [ ] WebSocket 연결 안정성
  - [ ] 일괄 처리 성능

---

## 🚀 즉시 시작

```bash
# 1. 브랜치 생성
git checkout -b feature/admin-redesign

# 2. DB 뷰 파일 생성
mkdir -p server/db/schema
touch server/db/schema/views.ts

# 3. API 라우트 생성
mkdir -p server/routes/admin
touch server/routes/admin/dashboard.routes.ts
touch server/routes/admin/batch.routes.ts

# 4. 프론트엔드 페이지 생성
touch admin/src/pages/TaskQueuePage.tsx

# 5. WebSocket 서버
mkdir -p server/websocket
touch server/websocket/admin-realtime.ts
```

**다음 단계를 시작하시겠습니까?**

1. DB 뷰 생성 코드 작성
2. API 엔드포인트 구현
3. 프론트엔드 페이지 개발
4. WebSocket 실시간 업데이트

어떤 부분부터 시작하고 싶으신가요?
