import { useRef, RefObject } from 'react';
import { TextInput, ScrollView, findNodeHandle, View } from 'react-native';
import { useNotification } from './useNotification';

export interface ValidationRule {
  fieldName: string;
  displayName: string;
  value: any;
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  customValidator?: (value: any) => boolean;
  errorMessage?: string;
}

export interface FieldRef {
  fieldName: string;
  ref: RefObject<any>;
  scrollViewRef?: RefObject<ScrollView | null>;
}

/**
 * 폼 검증 및 자동 네비게이션 훅
 *
 * @example
 * ```typescript
 * const { validate, fieldRefs, registerField } = useFormValidation();
 *
 * const companyRef = useRef<TextInput>(null);
 * const emailRef = useRef<TextInput>(null);
 *
 * useEffect(() => {
 *   registerField('company', companyRef, scrollViewRef);
 *   registerField('email', emailRef, scrollViewRef);
 * }, []);
 *
 * const handleSubmit = () => {
 *   const isValid = validate([
 *     { fieldName: 'company', displayName: '회사명', value: form.company, required: true },
 *     { fieldName: 'email', displayName: '이메일', value: form.email, required: true, pattern: /\S+@\S+\.\S+/ },
 *   ]);
 *
 *   if (isValid) {
 *     // Submit form
 *   }
 * };
 * ```
 */
export function useFormValidation() {
  const notification = useNotification();
  const fieldRefsMap = useRef<Map<string, FieldRef>>(new Map());

  /**
   * 필드 ref 등록
   */
  const registerField = (
    fieldName: string,
    ref: RefObject<any>,
    scrollViewRef?: RefObject<ScrollView | null>
  ) => {
    fieldRefsMap.current.set(fieldName, { fieldName, ref, scrollViewRef });
  };

  /**
   * 필드 ref 해제
   */
  const unregisterField = (fieldName: string) => {
    fieldRefsMap.current.delete(fieldName);
  };

  /**
   * 특정 필드로 스크롤 및 포커스
   */
  const scrollToField = (fieldName: string, displayName?: string) => {
    const fieldRef = fieldRefsMap.current.get(fieldName);

    if (!fieldRef || !fieldRef.ref.current) {
      console.warn(`Field ref for "${fieldName}" not found or not mounted`);
      return;
    }

    // 스크롤 먼저
    if (fieldRef.scrollViewRef?.current) {
      const nodeHandle = findNodeHandle(fieldRef.ref.current);
      if (nodeHandle) {
        fieldRef.ref.current.measureLayout(
          findNodeHandle(fieldRef.scrollViewRef.current) as number,
          (x: number, y: number) => {
            fieldRef.scrollViewRef?.current?.scrollTo({
              y: Math.max(0, y - 100), // 상단 여백 100px
              animated: true,
            });
          },
          () => {
            console.warn('Failed to measure field layout');
          }
        );
      }
    }

    // 포커스 (약간의 딜레이 후)
    setTimeout(() => {
      if (fieldRef.ref.current?.focus) {
        fieldRef.ref.current.focus();
      }
    }, 300);
  };

  /**
   * 검증 규칙에 따라 폼 검증 및 첫 번째 오류 필드로 이동
   *
   * @returns true if valid, false otherwise
   */
  const validate = (rules: ValidationRule[]): boolean => {
    for (const rule of rules) {
      const { fieldName, displayName, value, required, pattern, minLength, maxLength, customValidator, errorMessage } = rule;

      // Required 체크
      if (required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        notification.warning(`${displayName}을(를) 입력해주세요.`, '필수 입력');
        scrollToField(fieldName, displayName);
        return false;
      }

      // Pattern 체크
      if (value && pattern && !pattern.test(value)) {
        notification.error(
          errorMessage || `${displayName} 형식이 올바르지 않습니다.`,
          '입력 오류'
        );
        scrollToField(fieldName, displayName);
        return false;
      }

      // Min length 체크
      if (value && minLength && value.length < minLength) {
        notification.error(
          errorMessage || `${displayName}은(는) 최소 ${minLength}자 이상이어야 합니다.`,
          '입력 오류'
        );
        scrollToField(fieldName, displayName);
        return false;
      }

      // Max length 체크
      if (value && maxLength && value.length > maxLength) {
        notification.error(
          errorMessage || `${displayName}은(는) 최대 ${maxLength}자까지 입력 가능합니다.`,
          '입력 오류'
        );
        scrollToField(fieldName, displayName);
        return false;
      }

      // Custom validator 체크
      if (value && customValidator && !customValidator(value)) {
        notification.error(
          errorMessage || `${displayName}이(가) 유효하지 않습니다.`,
          '입력 오류'
        );
        scrollToField(fieldName, displayName);
        return false;
      }
    }

    return true;
  };

  /**
   * 빠른 검증 (토스트 없이)
   */
  const validateSilent = (rules: ValidationRule[]): boolean => {
    for (const rule of rules) {
      const { value, required, pattern, minLength, maxLength, customValidator } = rule;

      if (required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return false;
      }

      if (value && pattern && !pattern.test(value)) {
        return false;
      }

      if (value && minLength && value.length < minLength) {
        return false;
      }

      if (value && maxLength && value.length > maxLength) {
        return false;
      }

      if (value && customValidator && !customValidator(value)) {
        return false;
      }
    }

    return true;
  };

  return {
    validate,
    validateSilent,
    registerField,
    unregisterField,
    scrollToField,
  };
}
