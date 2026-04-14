import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

export default [
  // 主服务构建配置 - 编译并压缩TypeScript
  {
    input: 'src/main.ts',
    output: {
      file: 'dist/main.js',
      format: 'esm',
    },
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({ 
        module: "ESNext",
        target: "ES2020",
        skipLibCheck: true
      }),
      // terser({
      //   compress: {
      //     ecma: 2017,
      //     toplevel: true
      //   },
      //   output: {
      //     ecma: '2020'
      //   }
      // })
    ]
  },
  // 前端构建配置 - 编译并压缩JavaScript
  {
    input: 'src/frontend/main.js',
    output: {
      file: 'dist/frontend/main.js',
      format: 'iife',
      name: 'LevilaminaLSEFrontend',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      json(),
      terser({
        compress: {
          ecma: 2017,
          toplevel: true
        },
        output: {
          ecma: '2020'
        }
      })
    ]
  }
];