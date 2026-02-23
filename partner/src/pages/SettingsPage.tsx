import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Users, Phone, Briefcase, QrCode, Save, Copy, Shield } from 'lucide-react';

interface SettingsData {
  team: {
    id: number;
    name: string;
    businessType: string | null;
    emergencyPhone: string | null;
    commissionRate: number;
    qrCodeToken: string;
    isActive: boolean;
    createdAt: string;
  };
  leader: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
  } | null;
  stats: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
  };
}

export default function SettingsPage() {
  const { team } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [businessType, setBusinessType] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/settings');
      setData(res);
      setEmergencyPhone(res.team.emergencyPhone || '');
      setBusinessType(res.team.businessType || '');
    } catch (error) {
      toast({ title: '오류', description: '설정을 불러오는데 실패했습니다', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiRequest('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ emergencyPhone, businessType }),
      });
      toast({ title: '저장 완료', description: '설정이 저장되었습니다' });
      fetchSettings();
    } catch (error) {
      toast({ title: '오류', description: '저장에 실패했습니다', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '복사 완료', description: '클립보드에 복사되었습니다' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-muted-foreground">설정을 불러올 수 없습니다</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-muted-foreground">팀 정보 및 설정을 관리합니다</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 팀 정보 (읽기 전용) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              팀 정보
            </CardTitle>
            <CardDescription>본사에서 관리하는 정보입니다 (읽기 전용)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs">팀명</Label>
              <p className="font-medium">{data.team.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">수수료율</Label>
              <p className="font-medium">{data.team.commissionRate}%</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">상태</Label>
              <p className="font-medium">{data.team.isActive ? '활성' : '비활성'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">생성일</Label>
              <p className="font-medium">{new Date(data.team.createdAt).toLocaleDateString('ko-KR')}</p>
            </div>
          </CardContent>
        </Card>

        {/* 팀장 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              팀장 정보
            </CardTitle>
            <CardDescription>팀장 계정 정보</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.leader && (
              <>
                <div>
                  <Label className="text-muted-foreground text-xs">이름</Label>
                  <p className="font-medium">{data.leader.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">이메일</Label>
                  <p className="font-medium">{data.leader.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">연락처</Label>
                  <p className="font-medium">{data.leader.phoneNumber || '-'}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 팀원 현황 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              팀원 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{data.stats.totalMembers}</p>
                <p className="text-xs text-muted-foreground">전체</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{data.stats.activeMembers}</p>
                <p className="text-xs text-muted-foreground">활성</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-400">{data.stats.inactiveMembers}</p>
                <p className="text-xs text-muted-foreground">비활성</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 팀 초대 코드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              팀 초대 코드
            </CardTitle>
            <CardDescription>헬퍼가 팀에 가입할 때 사용하는 코드입니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-4 py-3 rounded-md text-sm font-mono tracking-wider">
                {data.team.qrCodeToken}
              </code>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(data.team.qrCodeToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 수정 가능한 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            팀 설정
          </CardTitle>
          <CardDescription>아래 항목은 직접 수정할 수 있습니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessType">업무 유형</Label>
              <Input
                id="businessType"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="예: 택배, 용달, 화물"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                긴급 연락처
              </Label>
              <Input
                id="emergencyPhone"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="예: 010-1234-5678"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '저장 중...' : '설정 저장'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
