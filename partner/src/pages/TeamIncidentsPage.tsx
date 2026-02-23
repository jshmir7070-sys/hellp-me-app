import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { AlertTriangle, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Incident {
  id: number;
  helperId: string;
  helperName: string;
  orderId?: number;
  incidentType: string;
  description: string;
  status: string;
  severity: string;
  teamLeaderNote?: string;
  adminNote?: string;
  resolvedAt?: string;
  createdAt: string;
}

interface TeamMember {
  id: number;
  helperId: string;
  isActive: boolean;
  user: { id: string; name: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  damage: '파손', loss: '분실', misdelivery: '오배송', delay: '지연', accident: '사고', other: '기타',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  reported: { label: '보고됨', color: 'bg-yellow-100 text-yellow-800' },
  investigating: { label: '조사중', color: 'bg-blue-100 text-blue-800' },
  resolved: { label: '해결', color: 'bg-green-100 text-green-800' },
  closed: { label: '종료', color: 'bg-gray-100 text-gray-800' },
};

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: '낮음', color: 'bg-green-100 text-green-800' },
  medium: { label: '보통', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: '높음', color: 'bg-orange-100 text-orange-800' },
  critical: { label: '심각', color: 'bg-red-100 text-red-800' },
};

export default function TeamIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formHelperId, setFormHelperId] = useState('');
  const [formOrderId, setFormOrderId] = useState('');
  const [formType, setFormType] = useState('other');
  const [formSeverity, setFormSeverity] = useState('medium');
  const [formDesc, setFormDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Note editing
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [statusFilter]);

  const loadMembers = async () => {
    try {
      const result = await apiRequest<{ members: TeamMember[] }>('/members');
      setMembers(result.members?.filter((m: any) => m.isActive) || []);
    } catch {}
  };

  const loadIncidents = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');
      const result = await apiRequest<{ incidents: Incident[] }>(`/incidents?${params.toString()}`);
      setIncidents(result.incidents);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formHelperId || !formDesc.trim()) {
      alert('헬퍼와 사고 내용을 입력해주세요');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/incidents', {
        method: 'POST',
        body: JSON.stringify({
          helperId: formHelperId,
          orderId: formOrderId || undefined,
          incidentType: formType,
          description: formDesc,
          severity: formSeverity,
        }),
      });
      setShowForm(false);
      setFormHelperId(''); setFormOrderId(''); setFormType('other'); setFormSeverity('medium'); setFormDesc('');
      loadIncidents();
    } catch (err: any) {
      alert(err.message || '사고 보고에 실패했습니다');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveNote = async (incidentId: number) => {
    try {
      await apiRequest(`/incidents/${incidentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ teamLeaderNote: noteText }),
      });
      setEditingNoteId(null);
      setNoteText('');
      loadIncidents();
    } catch (err: any) {
      alert(err.message || '메모 저장에 실패했습니다');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">팀사고관리</h1>
          <p className="text-sm text-muted-foreground mt-1">팀원 관련 사고 보고 및 추적</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? '닫기' : '사고 보고'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3">새 사고 보고</h3>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select value={formHelperId} onChange={(e) => setFormHelperId(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-background">
                <option value="">헬퍼 선택</option>
                {members.map((m) => (
                  <option key={m.helperId} value={m.helperId}>{m.user?.name || m.helperId}</option>
                ))}
              </select>
              <select value={formType} onChange={(e) => setFormType(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-background">
                <option value="damage">파손</option>
                <option value="loss">분실</option>
                <option value="misdelivery">오배송</option>
                <option value="delay">지연</option>
                <option value="accident">사고</option>
                <option value="other">기타</option>
              </select>
              <select value={formSeverity} onChange={(e) => setFormSeverity(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-background">
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
                <option value="critical">심각</option>
              </select>
              <input placeholder="오더번호 (선택)" value={formOrderId} onChange={(e) => setFormOrderId(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-background" />
            </div>
            <textarea placeholder="사고 내용을 상세히 입력하세요" value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
              rows={4} className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none" />
            <button onClick={handleCreate} disabled={creating}
              className="self-end px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
              {creating ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ value: '', label: '전체' }, { value: 'reported', label: '보고됨' }, { value: 'investigating', label: '조사중' }, { value: 'resolved', label: '해결' }, { value: 'closed', label: '종료' }].map((opt) => (
          <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Incidents list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : incidents.length === 0 ? (
          <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground text-sm">
            사고 내역이 없습니다
          </div>
        ) : (
          incidents.map((inc) => {
            const statusInfo = STATUS_LABELS[inc.status] || STATUS_LABELS.reported;
            const severityInfo = SEVERITY_LABELS[inc.severity] || SEVERITY_LABELS.medium;
            const isExpanded = expandedId === inc.id;
            return (
              <div key={inc.id} className="bg-card border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 text-left"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        [{TYPE_LABELS[inc.incidentType] || inc.incidentType}] {inc.helperName}
                        {inc.orderId ? ` — 오더 #${inc.orderId}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0 rounded text-xs font-medium ${severityInfo.color}`}>{severityInfo.label}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(inc.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 py-3 border-t bg-muted/10 space-y-3">
                    <p className="text-sm whitespace-pre-wrap">{inc.description}</p>
                    {inc.adminNote && (
                      <div className="p-3 bg-blue-50 rounded-md">
                        <p className="text-xs font-semibold text-blue-800 mb-1">본사 메모</p>
                        <p className="text-sm text-blue-900">{inc.adminNote}</p>
                      </div>
                    )}
                    {/* Team leader note */}
                    <div className="p-3 bg-muted/30 rounded-md">
                      <p className="text-xs font-semibold mb-1">팀장 메모</p>
                      {editingNoteId === inc.id ? (
                        <div className="flex gap-2">
                          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                            rows={2} className="flex-1 px-2 py-1 border rounded text-sm bg-background resize-none" />
                          <div className="flex flex-col gap-1">
                            <button onClick={() => handleSaveNote(inc.id)}
                              className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs">저장</button>
                            <button onClick={() => setEditingNoteId(null)}
                              className="px-3 py-1 border rounded text-xs">취소</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <p className="text-sm">{inc.teamLeaderNote || '메모 없음'}</p>
                          <button onClick={() => { setEditingNoteId(inc.id); setNoteText(inc.teamLeaderNote || ''); }}
                            className="text-xs text-primary hover:underline flex-shrink-0 ml-2">편집</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
