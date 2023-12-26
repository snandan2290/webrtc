const img = new Image;
const c = document.createElement('canvas');
const ctx = c.getContext('2d');
window.copyImageToClipboard = async (fileObj) => {
    setCanvasImage(fileObj.base64, (imgBlob) => {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': imgBlob })]);
    })
}
function setCanvasImage(blob, func) {
    img.onload = function () {
        c.width = this.naturalWidth;
        c.height = this.naturalHeight;
        ctx.drawImage(this, 0, 0);
        c.toBlob(blob => {
            func(blob)
        }, 'image/png')
    }
    img.src = blob;
} 