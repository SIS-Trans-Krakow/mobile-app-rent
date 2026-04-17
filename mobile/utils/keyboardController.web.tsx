import React from 'react';
import { ScrollView, View } from 'react-native';

export const KeyboardAwareScrollView: React.ComponentType<any> = ScrollView;

export const KeyboardAvoidingView: React.ComponentType<any> = ({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: any;
}) => <View style={style}>{children}</View>;

export const KeyboardProvider: React.ComponentType<any> = ({
  children,
}: {
  children?: React.ReactNode;
}) => <>{children}</>;
