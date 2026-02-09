import React from 'react';
import { render, fireEvent } from '../test-utils';
import { Button } from './Button';

describe('Button Component', () => {
  describe('Rendering', () => {
    it('should render with default props', () => {
      const { getByText } = render(<Button>Click me</Button>);
      expect(getByText('Click me')).toBeTruthy();
    });

    it('should render with custom testID', () => {
      const { getByTestId } = render(
        <Button testID="custom-button">Test Button</Button>
      );
      expect(getByTestId('custom-button')).toBeTruthy();
    });

    it('should render loading state with spinner', () => {
      const { getByTestId, queryByText } = render(
        <Button loading testID="loading-btn">
          Submit
        </Button>
      );
      expect(getByTestId('loading-btn')).toBeTruthy();
      // Text should be hidden during loading
      expect(queryByText('Submit')).toBeNull();
    });

    it('should render with icon', () => {
      const { getByTestId } = render(
        <Button icon="checkmark-circle-outline" testID="icon-btn">
          With Icon
        </Button>
      );
      expect(getByTestId('icon-btn')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('should render primary variant', () => {
      const { getByTestId } = render(
        <Button variant="primary" testID="primary-btn">
          Primary
        </Button>
      );
      expect(getByTestId('primary-btn')).toBeTruthy();
    });

    it('should render secondary variant', () => {
      const { getByTestId } = render(
        <Button variant="secondary" testID="secondary-btn">
          Secondary
        </Button>
      );
      expect(getByTestId('secondary-btn')).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { getByTestId } = render(
        <Button variant="outline" testID="outline-btn">
          Outline
        </Button>
      );
      expect(getByTestId('outline-btn')).toBeTruthy();
    });

    it('should render ghost variant', () => {
      const { getByTestId } = render(
        <Button variant="ghost" testID="ghost-btn">
          Ghost
        </Button>
      );
      expect(getByTestId('ghost-btn')).toBeTruthy();
    });

    it('should render gradient variant', () => {
      const { getByTestId } = render(
        <Button variant="gradient" testID="gradient-btn">
          Gradient
        </Button>
      );
      expect(getByTestId('gradient-btn')).toBeTruthy();
    });

    it('should render glass variant', () => {
      const { getByTestId } = render(
        <Button variant="glass" testID="glass-btn">
          Glass
        </Button>
      );
      expect(getByTestId('glass-btn')).toBeTruthy();
    });

    it('should render danger variant', () => {
      const { getByTestId } = render(
        <Button variant="danger" testID="danger-btn">
          Danger
        </Button>
      );
      expect(getByTestId('danger-btn')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('should render small size', () => {
      const { getByTestId } = render(
        <Button size="sm" testID="small-btn">
          Small
        </Button>
      );
      expect(getByTestId('small-btn')).toBeTruthy();
    });

    it('should render medium size (default)', () => {
      const { getByTestId } = render(
        <Button size="md" testID="medium-btn">
          Medium
        </Button>
      );
      expect(getByTestId('medium-btn')).toBeTruthy();
    });

    it('should render large size', () => {
      const { getByTestId } = render(
        <Button size="lg" testID="large-btn">
          Large
        </Button>
      );
      expect(getByTestId('large-btn')).toBeTruthy();
    });
  });

  describe('States', () => {
    it('should be disabled when disabled prop is true', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Button disabled onPress={onPress} testID="disabled-btn">
          Disabled
        </Button>
      );

      const button = getByTestId('disabled-btn');
      fireEvent.press(button);

      expect(onPress).not.toHaveBeenCalled();
    });

    it('should not call onPress when loading', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Button loading onPress={onPress} testID="loading-btn">
          Loading
        </Button>
      );

      const button = getByTestId('loading-btn');
      fireEvent.press(button);

      expect(onPress).not.toHaveBeenCalled();
    });

    it('should call onPress when enabled', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Button onPress={onPress} testID="active-btn">
          Active
        </Button>
      );

      const button = getByTestId('active-btn');
      fireEvent.press(button);

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Full Width', () => {
    it('should render full width button', () => {
      const { getByTestId } = render(
        <Button fullWidth testID="full-width-btn">
          Full Width
        </Button>
      );
      expect(getByTestId('full-width-btn')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label', () => {
      const { getByLabelText } = render(
        <Button accessibilityLabel="Submit form">Submit</Button>
      );
      expect(getByLabelText('Submit form')).toBeTruthy();
    });

    it('should have disabled accessibility state', () => {
      const { getByRole } = render(<Button disabled>Disabled Button</Button>);
      const button = getByRole('button');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });
  });
});
