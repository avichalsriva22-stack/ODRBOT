const { app } = require('electron');
app.whenReady().then(() => {
    console.log("USERDATA_PATH=" + app.getPath('userData'));
    app.quit();
});
