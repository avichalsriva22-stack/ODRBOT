/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, screen, ipcMain, safeStorage, net } = require( 'electron' );
const path = require( 'path' );
const fs = require( 'fs' );
const log = require( 'electron-log' );


// ─── AI API Key Storage (doc 07 §2) ─────────────────────────────────
// API key is encrypted at rest via Electron safeStorage (OS keychain /
// DPAPI / libsecret). Never readable from the renderer process.

const getAiKeyFile = (provider) => provider === 'anthropic'
	? path.join( app.getPath( 'userData' ), 'ai_key.bin' )
	: path.join( app.getPath( 'userData' ), `ai_key_${provider}.bin` );

function saveApiKey ( provider, plainTextKey ) {
	if ( !safeStorage.isEncryptionAvailable() ) return;
	const encrypted = safeStorage.encryptString( plainTextKey );
	fs.writeFileSync( getAiKeyFile(provider), encrypted );
}

function loadApiKey ( provider ) {
	const file = getAiKeyFile(provider);
	if ( !fs.existsSync( file ) ) return null;
	if ( !safeStorage.isEncryptionAvailable() ) return null;
	const encrypted = fs.readFileSync( file );
	return safeStorage.decryptString( encrypted );
}

function clearApiKey ( provider ) {
	const file = getAiKeyFile(provider);
	if ( fs.existsSync( file ) ) fs.unlinkSync( file );
}

function hasApiKey ( provider ) {
	return fs.existsSync( getAiKeyFile(provider) );
}

// ─── AI IPC Handlers (doc 07 §3) ────────────────────────────────────

ipcMain.handle( 'ai:set-api-key', ( event, provider, plainTextKey ) => {
	saveApiKey( provider, plainTextKey );
	return { ok: true };
} );

ipcMain.handle( 'ai:has-api-key', ( event, provider ) => hasApiKey( provider ) );

ipcMain.handle( 'ai:clear-api-key', ( event, provider ) => {
	clearApiKey( provider );
	return { ok: true };
} );

// Streaming completion: renderer sends a request id, main process streams
// chunks back via webContents.send on a per-request channel, and resolves
// the handle() call when the stream is done or errors.
const activeStreams = new Map(); // requestId -> AbortController

ipcMain.handle( 'ai:chat-completion-stream', async ( event, { requestId, provider, payload } ) => {

	const apiKey = loadApiKey( provider );

	if ( !apiKey ) {
		event.sender.send( `ai:stream-error:${ requestId }`, { kind: 'auth', message: 'No API key configured.' } );
		return;
	}

	const controller = new AbortController();
	activeStreams.set( requestId, controller );

	try {
		let endpoint, headers, body;
		if (provider === 'openrouter') {
			endpoint = 'https://openrouter.ai/api/v1/chat/completions';
			headers = {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
				'HTTP-Referer': 'http://localhost:4200',
				'X-Title': 'TrueVision AI Designer',
			};
			body = JSON.stringify( { ...payload, stream: true } );
		} else {
			endpoint = 'https://api.anthropic.com/v1/messages';
			headers = {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
			};
			body = JSON.stringify( { ...payload, stream: true } );
		}

		const request = net.request({
			method: 'POST',
			url: endpoint
		});

		for (const [key, value] of Object.entries(headers)) {
			request.setHeader(key, value);
		}

		request.write(body);

		request.on('response', (response) => {
			if (response.statusCode >= 400) {
				let errorText = '';
				response.on('data', (chunk) => { errorText += chunk.toString(); });
				response.on('end', () => {
					console.error(`AI API Error [${response.statusCode}]:`, errorText);
					const kind = response.statusCode === 401 ? 'auth' : response.statusCode === 429 ? 'rate_limit' : 'unknown';
					event.sender.send(`ai:stream-error:${requestId}`, { kind, message: `${provider} API error ${response.statusCode}`, status: response.statusCode });
				});
				return;
			}

			const createParser = provider === 'openrouter' ? require('./src/electron/openai-sse-parser').createOpenAiSseParser : require('./src/electron/anthropic-sse-parser').createAnthropicSseParser;

			try {
				const parseChunk = createParser((sseEvent) => {
					event.sender.send(`ai:stream-event:${requestId}`, sseEvent);
				});

				response.on('data', (chunk) => {
					try {
						parseChunk(chunk);
					} catch (err) {
						console.error('AI STREAM PARSE CHUNK ERROR:', err);
						event.sender.send(`ai:stream-error:${requestId}`, { kind: 'network', message: err.message });
					}
				});

				response.on('end', () => {
					event.sender.send(`ai:stream-done:${requestId}`);
				});
			} catch (err) {
				console.error('AI STREAM INIT PARSER ERROR:', err);
				event.sender.send(`ai:stream-error:${requestId}`, { kind: 'network', message: err.message });
			}
		});

		request.on('error', (err) => {
			console.error('AI REQUEST ERROR:', err);
			event.sender.send(`ai:stream-error:${requestId}`, { kind: 'network', message: err.message });
		});

		request.end();

	} catch ( err ) {
		console.error( 'AI STREAM CATCH ERROR:', err );
		if ( err.name === 'AbortError' ) {
			event.sender.send( `ai:stream-done:${ requestId }` );
		} else {
			event.sender.send( `ai:stream-error:${ requestId }`, { kind: 'network', message: err.message } );
		}
	} finally {
		activeStreams.delete( requestId );
	}
} );

ipcMain.handle( 'ai:cancel-stream', ( event, requestId ) => {
	const controller = activeStreams.get( requestId );
	if ( controller ) controller.abort();
	return { ok: true };
} );

log.initialize();
log.info( 'App Launched' );

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let editorWindow;

const TITLE = "Truevision"
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 980;

let openDevTools = false;
let showSplashScreen = true;

// load opengl to fix line rendering issues
app.commandLine.appendSwitch( "use-angle", "gl" );

process.argv.forEach( function ( arg, index, array ) {

	if ( arg.includes( "open-dev-tools" ) ) {
		openDevTools = true;
	} else if ( arg.includes( "disable-splash" ) ) {
		showSplashScreen = false;
	}

} );

function openEditorWindow () {

	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	// Create the browser window.
	editorWindow = new BrowserWindow( {
		title: TITLE,
		width: width,
		height: height,
		backgroundColor: '#000000', // Set background color to black
		icon: `file://${ __dirname }/dist/assets/icon.png`,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: true,
			allowRunningInsecureContent: true,
			preload: path.join( __dirname, 'preload.js' )
		}
	} );

	editorWindow.setMenuBarVisibility( false );

	const remoteMain = require( "@electron/remote/main" )
	remoteMain.initialize()
	remoteMain.enable( editorWindow.webContents )

	editorWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
		if (level >= 2) {
			console.log(`RENDERER ERROR [${sourceId}:${line}]: ${message}`);
		}
	});

	editorWindow.loadFile( 'dist/index.html' )

	// Open the DevTools.
	if ( openDevTools ) editorWindow.webContents.openDevTools();

	// Emitted when the window is closed.
	editorWindow.on( 'closed', function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		editorWindow = null
	} )

	editorWindow.on( 'ready-to-show', () => {

		log.info( 'editor window loaded' )

		checkForUpdates();

	} );
}

function checkForUpdates () {

	const { autoUpdater } = require( 'electron-updater' );
	autoUpdater.logger = log;
	autoUpdater.logger.transports.file.level = 'info';

	// Log "checking-for-update" event
	autoUpdater.on( 'checking-for-update', () => {
		console.log( '[electron-updater] Checking for update' );
	} );

	// Log "update-available" event
	autoUpdater.on( 'update-available', ( info ) => {
		console.log( '[electron-updater] Update available:', info );
	} );

	// Log "update-not-available" event
	autoUpdater.on( 'update-not-available', ( info ) => {
		console.log( '[electron-updater] Update not available:', info );
	} );

	// Log "error" event
	autoUpdater.on( 'error', ( err ) => {
		console.error( '[electron-updater] Update error:', err );
	} );

	// Log "download-progress" event
	autoUpdater.on( 'download-progress', ( progressObj ) => {
		console.log( '[electron-updater] Download progress:', progressObj );
	} );

	// Log "update-downloaded" event
	autoUpdater.on( 'update-downloaded', ( info ) => {
		console.log( '[electron-updater] Update downloaded:', info );
	} );

	autoUpdater.checkForUpdatesAndNotify();

}

function openSplashWindow () {

	// Create the browser window.
	let splashWindow = new BrowserWindow( {
		title: TITLE,
		width: 720,
		height: 405,
		backgroundColor: '#000000', // Set background color to black
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		closable: true,
		alwaysOnTop: true,
		fullscreenable: false,
		frame: false,
		icon: `file://${ __dirname }/dist/assets/icon.png`,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: true,
			allowRunningInsecureContent: true,
		}
	} );

	splashWindow.loadFile( 'dist/splash.html' )

	// Open the DevTools.
	if ( openDevTools ) splashWindow.webContents.openDevTools();

	// Emitted when the window is closed.
	splashWindow.on( 'closed', function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		splashWindow = null;
	} );


	setTimeout( () => {

		openEditorWindow();

		splashWindow.close();

	}, 5000 );
}

function createWindow () {

	if ( showSplashScreen == true ) {

		openSplashWindow();

	} else {

		openEditorWindow();

	}

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on( 'ready', createWindow )

// app.commandLine.appendSwitch( 'remote-debugging-port', '9222' )

// Quit when all windows are closed.
app.on( 'window-all-closed', function () {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if ( process.platform !== 'darwin' ) {
		app.quit()
	}
} );

app.on( 'activate', function () {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if ( editorWindow === null ) {
		createWindow()
	}
} );

// this is deprecated and not used anywhere
// // helpers method to read current directory in angular
// ipcMain.on( 'current-directory', ( event, arg ) => {
//     event.returnValue = __dirname;
// } );

// Create the Application's main menu
var template = [
	{
		label: TITLE,
		submenu: [
			{ label: "Quit", accelerator: "Command+Q", click: function () { app.quit(); } }
		]
	},
	{
		label: "Edit",
		submenu: [
			{ label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
			{ label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
			{ type: "separator" },
			{ label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
			{ label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
			{ label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
			{ label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
		]
	}
];

// not needed on windows
if ( process.platform === 'win32' ) {

	Menu.setApplicationMenu( null );

} else {

	Menu.setApplicationMenu( Menu.buildFromTemplate( template ) );
}
