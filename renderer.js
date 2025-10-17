// 这个文件可以在 index.html 中直接使用 script 标签引入
// 或者在主进程中通过 webPreferences.additionalScripts 配置加载

// 在这里可以添加一些通用的渲染进程逻辑
console.log('Renderer process loaded');

// 监听 DOM 内容加载完成
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded');
    
    // 可以在这里添加一些初始化逻辑
    // 例如绑定事件监听器等
});