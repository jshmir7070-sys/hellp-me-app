module.exports = {
  // 프로젝트별 설정
  projects: [
    {
      // 서버 (Node.js/Express) 테스트 설정
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/**/*.test.ts', '<rootDir>/server/**/*.spec.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: {
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
            },
          },
        ],
      },
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
      setupFiles: ['<rootDir>/server/__tests__/setup-env.ts'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      collectCoverageFrom: [
        'server/**/*.{ts,tsx}',
        '!server/**/*.d.ts',
        '!server/index.ts',
        '!server/**/*.test.ts',
        '!server/**/*.spec.ts',
      ],
    },
    {
      // 클라이언트 (React Native) 테스트 설정
      displayName: 'client',
      preset: 'react-native',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/client/**/*.test.tsx', '<rootDir>/client/**/*.spec.tsx'],
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|expo|@expo|@react-navigation|@tanstack)/)',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      collectCoverageFrom: [
        'client/**/*.{ts,tsx}',
        '!client/**/*.d.ts',
        '!client/index.js',
        '!client/**/*.test.tsx',
        '!client/**/*.spec.tsx',
      ],
    },
    {
      // Shared 코드 테스트 설정
      displayName: 'shared',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/shared/**/*.test.ts', '<rootDir>/shared/**/*.spec.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: {
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
            },
          },
        ],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      collectCoverageFrom: [
        'shared/**/*.{ts,tsx}',
        '!shared/**/*.d.ts',
        '!shared/**/*.test.ts',
        '!shared/**/*.spec.ts',
      ],
    },
  ],
  // 전역 설정
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};
