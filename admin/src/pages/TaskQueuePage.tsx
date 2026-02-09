/**
 * Task Queue Page - 재설계 버전
 * 업무 대기함 - 승인 대기 작업 통합 관리
 *
 * 개선사항:
 * - 고정 헤더 테이블로 변경
 * - 통계 카드 추가
 * - 필터 바 개선
 * - 배치 액션 UI 개선
 * - 상태 배지 표준화
 */

import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  useTaskQueue,
  useBatchApproveOrders,
  useBatchApproveSettlements,
  useBatchVerifyHelpers,
} from '@/hooks/useTaskQueue';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { StatusBadge, PriorityBadge, AmountBadge } from '@/components/ui/status-badge';
import { PageHeader, StatsCard, StatsGrid, FilterBar } from '@/components/ui/page-header';
import { BatchActions } from '@/components/ui/action-buttons';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Clock,
  Package,
  DollarSign,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
} from 'lucide-react';
import type { TaskQueueItem, TaskType } from '@/types/taskQueue';

const TASK_TYPE_CONFIG = {
  order_approval: {
    label: '오더 승인',
    icon: Package,
    color: 'bg-blue-500',
  },
  settlement_approval: {
    label: '정산 승인',
    icon: DollarSign,
    color: 'bg-green-500',
  },
  helper_verification: {
    label: '헬퍼 인증',
    icon: UserCheck,
    color: 'bg-purple-500',
  },
} as const;

export default function TaskQueuePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | TaskType>('all');
  const [selectedRows, setSelectedRows] = useState<TaskQueueItem[]>([]);

  // API 훅
  const { data: taskQueueData, isLoading, refetch } = useTaskQueue(
    activeTab !== 'all' ? { taskType: activeTab } : undefined
  );
  const batchApproveOrders = useBatchApproveOrders();
  const batchApproveSettlements = useBatchApproveSettlements();
  const batchVerifyHelpers = useBatchVerifyHelpers();

  const tasks = taskQueueData?.data || [];

  // 통계 계산
  const stats = useMemo(() => {
    const byType = {
      order_approval: tasks.filter((t) => t.taskType === 'order_approval').length,
      settlement_approval: tasks.filter((t) => t.taskType === 'settlement_approval').length,
      helper_verification: tasks.filter((t) => t.taskType === 'helper_verification').length,
    };

    const urgent = tasks.filter((t) => t.priority === 1).length;
    const avgWaitTime = tasks.length > 0
      ? tasks.reduce((sum, t) => sum + t.waitingMinutes, 0) / tasks.length
      : 0;

    return { byType, urgent, avgWaitTime };
  }, [tasks]);

  // 선택된 작업들을 타입별로 그룹화
  const selectedTasksByType = useMemo(() => {
    const groups: Record<TaskType, number[]> = {
      order_approval: [],
      settlement_approval: [],
      helper_verification: [],
    };

    selectedRows.forEach((task) => {
      if (task.taskType === 'order_approval') {
        groups.order_approval.push(task.relatedData.orderId!);
      } else if (task.taskType === 'settlement_approval') {
        groups.settlement_approval.push(task.relatedData.settlementId!);
      } else if (task.taskType === 'helper_verification') {
        groups.helper_verification.push(task.relatedData.verificationId!);
      }
    });

    return groups;
  }, [selectedRows]);

  // 일괄 승인
  const handleBatchApprove = async () => {
    const orderIds = selectedTasksByType.order_approval;
    const settlementIds = selectedTasksByType.settlement_approval;
    const verificationIds = selectedTasksByType.helper_verification;

    try {
      const promises = [];

      if (orderIds.length > 0) {
        promises.push(batchApproveOrders.mutateAsync({ orderIds }));
      }
      if (settlementIds.length > 0) {
        promises.push(batchApproveSettlements.mutateAsync({ settlementIds }));
      }
      if (verificationIds.length > 0) {
        promises.push(batchVerifyHelpers.mutateAsync({ verificationIds }));
      }

      await Promise.all(promises);

      toast({
        title: '일괄 승인 완료',
        description: `${selectedRows.length}개의 작업이 성공적으로 승인되었습니다.`,
      });

      setSelectedRows([]);
      refetch();
    } catch (error: any) {
      toast({
        title: '일괄 승인 실패',
        description: error.message || '일부 작업 승인에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 테이블 컬럼 정의
  const columns: ColumnDef<TaskQueueItem>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="전체 선택"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="행 선택"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'taskType',
      header: '유형',
      cell: ({ row }) => {
        const config = TASK_TYPE_CONFIG[row.original.taskType];
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{config.label}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'priority',
      header: ({ column }) => <SortableHeader column={column}>우선순위</SortableHeader>,
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
    {
      accessorKey: 'waitingMinutes',
      header: ({ column }) => <SortableHeader column={column}>대기 시간</SortableHeader>,
      cell: ({ row }) => {
        const minutes = row.original.waitingMinutes;
        const isUrgent = minutes > 60;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        const display = minutes < 60 ? `${Math.round(minutes)}분` : `${hours}시간 ${mins}분`;

        return (
          <div className="flex items-center gap-2">
            {isUrgent && <AlertTriangle className="h-4 w-4 text-orange-500" />}
            <span className={isUrgent ? 'text-orange-600 font-medium' : ''}>
              {display}
            </span>
          </div>
        );
      },
    },
    {
      id: 'details',
      header: '상세 정보',
      cell: ({ row }) => {
        const data = row.original.relatedData;
        return (
          <div className="space-y-1 max-w-md">
            {data.requesterName && (
              <div className="text-sm">
                <span className="text-muted-foreground">의뢰자:</span>{' '}
                <span className="font-medium">{data.requesterName}</span>
                {data.requesterCompany && (
                  <span className="text-muted-foreground ml-1">({data.requesterCompany})</span>
                )}
              </div>
            )}
            {data.helperName && (
              <div className="text-sm">
                <span className="text-muted-foreground">헬퍼:</span>{' '}
                <span className="font-medium">{data.helperName}</span>
              </div>
            )}
            {data.deliveryArea && (
              <div className="text-sm text-muted-foreground truncate">
                {data.deliveryArea}
                {data.campAddress && ` → ${data.campAddress}`}
              </div>
            )}
            {data.isUrgent && (
              <StatusBadge status="pending" label="긴급" size="sm" />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>금액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => {
        const amount = row.original.relatedData.amount;
        if (!amount) return <div className="text-right text-muted-foreground">-</div>;

        return (
          <div className="text-right space-y-1">
            <div className="font-medium">
              {new Intl.NumberFormat('ko-KR', {
                style: 'currency',
                currency: 'KRW',
              }).format(amount)}
            </div>
            <AmountBadge amount={amount} />
          </div>
        );
      },
    },
  ];

  // 로딩 중
  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <PageHeader
        title="업무 대기함"
        description="승인 대기 중인 작업을 한 번에 처리하세요 • 실시간 업데이트 (WebSocket + 30초 폴링)"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <Clock className="h-4 w-4 mr-2" />
              새로고침
            </Button>
          </>
        }
      />

      {/* 통계 카드 */}
      <StatsGrid>
        <StatsCard
          title="전체 대기 작업"
          value={tasks.length}
          description="처리 대기 중"
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="긴급 작업"
          value={stats.urgent}
          description="1시간 이상 대기"
          icon={<Zap className="h-5 w-5 text-orange-500" />}
          variant={stats.urgent > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="평균 대기 시간"
          value={`${Math.round(stats.avgWaitTime)}분`}
          description="전체 작업 평균"
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          variant="default"
        />
        <StatsCard
          title="선택됨"
          value={selectedRows.length}
          description={selectedRows.length > 0 ? "일괄 처리 준비됨" : "작업 선택하기"}
          icon={<CheckCircle2 className="h-5 w-5 text-purple-500" />}
          variant={selectedRows.length > 0 ? "primary" : "default"}
        />
      </StatsGrid>

      {/* 배치 액션 */}
      <BatchActions
        selectedCount={selectedRows.length}
        onApprove={handleBatchApprove}
        loading={
          batchApproveOrders.isPending ||
          batchApproveSettlements.isPending ||
          batchVerifyHelpers.isPending
        }
      />

      {/* 필터 바 */}
      <FilterBar
        filters={[
          {
            key: 'taskType',
            label: '작업 유형',
            options: [
              { label: `전체 (${tasks.length})`, value: 'all' },
              { label: `오더 승인 (${stats.byType.order_approval})`, value: 'order_approval' },
              { label: `정산 승인 (${stats.byType.settlement_approval})`, value: 'settlement_approval' },
              { label: `헬퍼 인증 (${stats.byType.helper_verification})`, value: 'helper_verification' },
            ],
            value: activeTab,
            onChange: (value) => setActiveTab(value as any),
          },
        ]}
        showRefresh={false}
        showExport={false}
      />

      {/* 데이터 테이블 */}
      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-12 w-12 text-green-500" />}
          title="처리할 작업이 없습니다"
          description="모든 승인 작업이 완료되었습니다. 새로운 작업이 생기면 자동으로 표시됩니다."
        />
      ) : (
        <DataTable
          columns={columns}
          data={tasks}
          pageSize={20}
          fixedHeader={true}
          maxHeight="calc(100vh - 500px)"
          loading={isLoading}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
        />
      )}
    </div>
  );
}
