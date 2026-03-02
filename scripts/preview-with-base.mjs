#!/usr/bin/env node
/**
 * Preview с base path: копирует dist в preview-serve/telegram-card-game/,
 * чтобы /telegram-card-game/assets/xxx корректно резолвились.
 * Запуск: npm run preview:base
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const outDir = path.join(root, 'preview-serve', 'telegram-card-game')

function copyRecursive(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

if (fs.existsSync(path.join(root, 'preview-serve'))) {
  fs.rmSync(path.join(root, 'preview-serve'), { recursive: true })
}
fs.mkdirSync(outDir, { recursive: true })
for (const name of fs.readdirSync(distDir)) {
  copyRecursive(path.join(distDir, name), path.join(outDir, name))
}

console.log('Preview: http://localhost:4173/telegram-card-game/')
spawn('npx', ['serve', 'preview-serve', '-l', '4173'], {
  stdio: 'inherit',
  cwd: root,
})
