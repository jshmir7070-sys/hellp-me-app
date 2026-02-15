/**
 * 오더 작성 중 임시 저장 관리
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_KEY = '@order_draft';

export interface OrderDraft {
  step: number; // 현재 단계 (1-7)
  category: '택배사' | '기타택배' | '냉탑전용';
  courierForm: any;
  otherCourierForm: any;
  coldTruckForm: any;
  imageUri: string | null;
  savedAt: string; // ISO timestamp
}

/**
 * 임시 저장
 */
export async function saveDraft(draft: OrderDraft): Promise<void> {
  try {
    const draftData = {
      ...draft,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
  } catch (error) {
    console.error('Failed to save draft:', error);
  }
}

/**
 * 임시 저장 불러오기
 */
export async function loadDraft(): Promise<OrderDraft | null> {
  try {
    const draftJson = await AsyncStorage.getItem(DRAFT_KEY);
    if (!draftJson) return null;
    
    const draft = JSON.parse(draftJson) as OrderDraft;
    
    // 24시간 이상 지난 임시 저장은 무시
    const savedAt = new Date(draft.savedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      await clearDraft();
      return null;
    }
    
    return draft;
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
}

/**
 * 임시 저장 삭제
 */
export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error('Failed to clear draft:', error);
  }
}

/**
 * 임시 저장 존재 여부 확인
 */
export async function hasDraft(): Promise<boolean> {
  try {
    const draft = await loadDraft();
    return draft !== null;
  } catch (error) {
    return false;
  }
}
