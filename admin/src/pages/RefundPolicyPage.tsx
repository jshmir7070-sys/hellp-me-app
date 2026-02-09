import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Save, RefreshCw } from 'lucide-react';

interface RefundPolicy {
  id: number;
  policyType: 'before_matching' | 'after_matching';
  refundRate: number;
  description: string;
  updatedAt: string;
}

export default function RefundPolicyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [beforeMatching, setBeforeMatching] = useState({
    refundRate: 100,
    description: '매칭 전 취소 시 전액 환불',
  });

  const [afterMatching, setAfterMatching] = useState({
    refundRate: 0,
    description: '매칭 후 취소 시 환불 불가',
  });

  const { data: policies, isLoading, refetch } = useQuery<RefundPolicy[]>({
    queryKey: ['refund-policies'],
    queryFn: async () => {
      try {
        const data = await apiRequest<RefundPolicy[]>('/refund-policies');
        return data;
      } catch {
        return [];
      }
    },
  });

  useEffect(() => {
    if (policies && policies.length > 0) {
      const before = policies.find(p => p.policyType === 'before_matching');
      const after = policies.find(p => p.policyType === 'after_matching');
      if (before) {
        setBeforeMatching({
          refundRate: before.refundRate,
          description: before.description,
        });
      }
      if (after) {
        setAfterMatching({
          refundRate: after.refundRate,
          description: after.description,
        });
      }
    }
  }, [policies]);

  const saveMutation = useMutation({
    mutationFn: async (policies: { before: typeof beforeMatching; after: typeof afterMatching }) => {
      return apiRequest('/refund-policies', {
        method: 'PUT',
        body: JSON.stringify({
          beforeMatching: policies.before,
          afterMatching: policies.after,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: '저장 완료', description: '환불 정책이 저장되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['refund-policies'] });
    },
    onError: () => {
      toast({ title: '저장 실패', description: '환불 정책 저장에 실패했습니다.', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ before: beforeMatching, after: afterMatching });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">환불 정책</h1>
          <p className="text-muted-foreground">매칭 전/후 환불 정책을 설정합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            저장
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="bg-green-50 border-b">
            <CardTitle className="text-green-800">매칭 전 환불</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="before-rate">환불율 (%)</Label>
              <Input
                id="before-rate"
                type="number"
                min={0}
                max={100}
                value={beforeMatching.refundRate}
                onChange={(e) => setBeforeMatching(prev => ({ ...prev, refundRate: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label htmlFor="before-desc">설명</Label>
              <Textarea
                id="before-desc"
                value={beforeMatching.description}
                onChange={(e) => setBeforeMatching(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="p-3 bg-muted rounded text-sm">
              <strong>적용 시점:</strong> 헬퍼가 아직 배정되지 않은 상태에서 취소할 경우
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-red-50 border-b">
            <CardTitle className="text-red-800">매칭 후 환불</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="after-rate">환불율 (%)</Label>
              <Input
                id="after-rate"
                type="number"
                min={0}
                max={100}
                value={afterMatching.refundRate}
                onChange={(e) => setAfterMatching(prev => ({ ...prev, refundRate: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label htmlFor="after-desc">설명</Label>
              <Textarea
                id="after-desc"
                value={afterMatching.description}
                onChange={(e) => setAfterMatching(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="p-3 bg-muted rounded text-sm">
              <strong>적용 시점:</strong> 헬퍼가 배정된 이후 취소할 경우
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>환불 정책 안내</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>매칭 전:</strong> 요청자가 오더를 등록했지만 헬퍼가 아직 배정되지 않은 상태</p>
            <p>• <strong>매칭 후:</strong> 헬퍼가 배정되어 예정 또는 진행 중인 상태</p>
            <p>• 환불율 100%는 전액 환불, 0%는 환불 불가를 의미합니다.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
