import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat();

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['dca-tracker-ui-ref/**', 'data/**', '.next/**'] },
];
