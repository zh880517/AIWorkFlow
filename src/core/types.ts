// 实现已迁到 shared/src（插件与主工程共用同一份，不再从 src/ 反向引用）。
// 这个文件只保留老路径给 src/ 内部与测试用；新代码请直接 import @shared/types.js。
export * from '../../shared/src/types.js';