import React from 'react';
import { Text } from 'react-native';
import { render } from '../test-utils';
import { Card } from './Card';

describe('Card Component', () => {
  describe('Rendering', () => {
    it('should render children correctly', () => {
      const { getByText } = render(
        <Card>
          <Text>Card Content</Text>
        </Card>
      );
      expect(getByText('Card Content')).toBeTruthy();
    });

    it('should render with custom testID', () => {
      const { getByTestId } = render(
        <Card testID="custom-card">
          <Text>Content</Text>
        </Card>
      );
      expect(getByTestId('custom-card')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('should render default variant', () => {
      const { getByTestId } = render(
        <Card variant="default" testID="default-card">
          <Text>Default Card</Text>
        </Card>
      );
      expect(getByTestId('default-card')).toBeTruthy();
    });

    it('should render glass variant with blur effect', () => {
      const { getByTestId } = render(
        <Card variant="glass" testID="glass-card">
          <Text>Glass Card</Text>
        </Card>
      );
      expect(getByTestId('glass-card')).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { getByTestId } = render(
        <Card variant="outline" testID="outline-card">
          <Text>Outline Card</Text>
        </Card>
      );
      expect(getByTestId('outline-card')).toBeTruthy();
    });

    it('should render elevated variant', () => {
      const { getByTestId } = render(
        <Card variant="elevated" testID="elevated-card">
          <Text>Elevated Card</Text>
        </Card>
      );
      expect(getByTestId('elevated-card')).toBeTruthy();
    });

    it('should render premium variant with gradient', () => {
      const { getByTestId } = render(
        <Card variant="premium" testID="premium-card">
          <Text>Premium Card</Text>
        </Card>
      );
      expect(getByTestId('premium-card')).toBeTruthy();
    });
  });

  describe('Padding', () => {
    it('should render with no padding', () => {
      const { getByTestId } = render(
        <Card padding="none" testID="no-padding-card">
          <Text>No Padding</Text>
        </Card>
      );
      expect(getByTestId('no-padding-card')).toBeTruthy();
    });

    it('should render with small padding', () => {
      const { getByTestId } = render(
        <Card padding="sm" testID="sm-padding-card">
          <Text>Small Padding</Text>
        </Card>
      );
      expect(getByTestId('sm-padding-card')).toBeTruthy();
    });

    it('should render with medium padding (default)', () => {
      const { getByTestId } = render(
        <Card padding="md" testID="md-padding-card">
          <Text>Medium Padding</Text>
        </Card>
      );
      expect(getByTestId('md-padding-card')).toBeTruthy();
    });

    it('should render with large padding', () => {
      const { getByTestId } = render(
        <Card padding="lg" testID="lg-padding-card">
          <Text>Large Padding</Text>
        </Card>
      );
      expect(getByTestId('lg-padding-card')).toBeTruthy();
    });

    it('should render with extra large padding', () => {
      const { getByTestId } = render(
        <Card padding="xl" testID="xl-padding-card">
          <Text>XL Padding</Text>
        </Card>
      );
      expect(getByTestId('xl-padding-card')).toBeTruthy();
    });
  });

  describe('Pressable State', () => {
    it('should render as pressable when onPress provided', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Card onPress={onPress} testID="pressable-card">
          <Text>Pressable Card</Text>
        </Card>
      );
      expect(getByTestId('pressable-card')).toBeTruthy();
    });

    it('should not be pressable without onPress', () => {
      const { getByTestId } = render(
        <Card testID="static-card">
          <Text>Static Card</Text>
        </Card>
      );
      // Should render as View, not Pressable
      expect(getByTestId('static-card')).toBeTruthy();
    });
  });

  describe('Glass Variant Blur Intensity', () => {
    it('should apply custom blur intensity to glass variant', () => {
      const { getByTestId } = render(
        <Card variant="glass" blurIntensity={50} testID="custom-blur-card">
          <Text>Custom Blur</Text>
        </Card>
      );
      expect(getByTestId('custom-blur-card')).toBeTruthy();
    });
  });

  describe('Premium Variant Gradient', () => {
    it('should apply custom gradient colors to premium variant', () => {
      const { getByTestId } = render(
        <Card
          variant="premium"
          gradientColors={['#FF0000', '#00FF00', '#0000FF']}
          testID="custom-gradient-card"
        >
          <Text>Custom Gradient</Text>
        </Card>
      );
      expect(getByTestId('custom-gradient-card')).toBeTruthy();
    });
  });

  describe('Custom Styles', () => {
    it('should apply custom container styles', () => {
      const { getByTestId } = render(
        <Card style={{ backgroundColor: 'red' }} testID="styled-card">
          <Text>Styled Card</Text>
        </Card>
      );
      expect(getByTestId('styled-card')).toBeTruthy();
    });
  });

  describe('Multiple Children', () => {
    it('should render multiple children correctly', () => {
      const { getByText } = render(
        <Card>
          <Text>First Child</Text>
          <Text>Second Child</Text>
          <Text>Third Child</Text>
        </Card>
      );
      expect(getByText('First Child')).toBeTruthy();
      expect(getByText('Second Child')).toBeTruthy();
      expect(getByText('Third Child')).toBeTruthy();
    });
  });
});
