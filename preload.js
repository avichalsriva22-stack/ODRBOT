const { contextBridge, ipcRenderer } = require( 'electron' )
const remote = require( '@electron/remote' )
const fs = require( 'fs' )
const converter = require( 'fbx2gltf' );

// NOTE: fs.stat on macos is not working properly this is bug fix
const statHelper = {
	isFile: ( path ) => fs.statSync( path ).isFile(),
	isDirectory: ( path ) => fs.statSync( path ).isDirectory(),
	isBlockDevice: ( path ) => fs.statSync( path ).isBlockDevice(),
	isCharacterDevice: ( path ) => fs.statSync( path ).isCharacterDevice(),
	isSymbolicLink: ( path ) => fs.statSync( path ).isSymbolicLink(),
	isFIFO: ( path ) => fs.statSync( path ).isFIFO(),
	isSocket: ( path ) => fs.statSync( path ).isSocket(),
}

contextBridge.exposeInMainWorld( 'electronFs', {
	currentDirectory: __dirname,
	remote: () => remote,
	getUserDataPath: () => remote.app.getPath('userData'),
	setTitle: ( name ) => remote.getCurrentWindow().setTitle( name ),
	fs: () => fs,
	fsPromises: () => require( 'fs/promises' ),
	path: () => require( 'path' ),
	stat: statHelper
} )

contextBridge.exposeInMainWorld( 'buffer', {
	from: ( buffer, arg1 ) => arg1 ? Buffer.from( buffer, arg1 ) : Buffer.from( buffer ),
} )

contextBridge.exposeInMainWorld( 'fbxToGlTF', {
	convert: ( sourcePath, destinationPath ) => converter( sourcePath, destinationPath )
} );

contextBridge.exposeInMainWorld( 'stat', statHelper )

contextBridge.exposeInMainWorld( 'process', remote.process )

contextBridge.exposeInMainWorld( 'require', remote.require )

// not in use for testing
contextBridge.exposeInMainWorld( 'dialog', {
	showSaveDialog: ( options ) => remote.dialog.showSaveDialog( options )
} )

contextBridge.exposeInMainWorld( 'fxp', {
	XMLParser: () => require( 'fast-xml-parser' ).XMLParser,
	XMLBuilder: () => require( 'fast-xml-parser' ).XMLBuilder,
	XMLValidator: () => require( 'fast-xml-parser' ).XMLValidator,
} )

const menus = new Array( 20 );
contextBridge.exposeInMainWorld( 'menus', {
	append: ( type, tempate ) => {
		const menu = new remote.Menu.buildFromTemplate( tempate );
		menus[ type ] = menu;
	},
	popup: ( type ) => {
		const m = menus[ type ];
		m.popup( {
			window: remote.getCurrentWindow()
		} );
	}
} )


// var child = require( 'child_process' ).exec;
var spawn = require( 'child_process' ).spawn;

// var binPath = null;
// var scenarioPath = null;
// var command = binPath + " --window 60 60 800 400" + " --odr " + scenarioPath;
contextBridge.exposeInMainWorld( 'command', {
	// setBinPath: ( value ) => binPath = value,
	// setScenarioPath: ( value ) => scenarioPath = value,
	// execute: () => child( command, function ( err, data ) {
	// 	console.log( err )
	// 	console.log( data.toString() );
	// } ),
	spawn: ( exec, args, out, err, close ) => {

		var cmd = spawn( exec, args );

		cmd.stdout.on( 'data', function ( data ) {
			out( data.toString() );
		} );

		cmd.stderr.on( 'data', function ( data ) {
			err( data.toString() );
		} )

		cmd.on( 'close', function ( code ) {
			close( code );
		} )

		return cmd;
	}
} )

// ─── AI Bridge (doc 07 §4) ──────────────────────────────────────────
// Write-only API key management + streaming chat completion.
// No getApiKey exposed — structurally impossible for renderer code
// (including any future AI-authored code, or a compromised dependency)
// to read the key back out.
contextBridge.exposeInMainWorld( 'aiBridge', {

	setApiKey: ( provider, key ) => ipcRenderer.invoke( 'ai:set-api-key', provider, key ),
	hasApiKey: ( provider ) => ipcRenderer.invoke( 'ai:has-api-key', provider ),
	clearApiKey: ( provider ) => ipcRenderer.invoke( 'ai:clear-api-key', provider ),

	streamChatCompletion: ( provider, payload, onEvent, onError, onDone ) => {

		const requestId = `${ Date.now() }-${ Math.random().toString( 36 ).slice( 2 ) }`;

		const eventChannel = `ai:stream-event:${ requestId }`;
		const errorChannel = `ai:stream-error:${ requestId }`;
		const doneChannel = `ai:stream-done:${ requestId }`;

		const onEventFn = ( _e, data ) => onEvent( data );
		const onErrorFn = ( _e, data ) => onError( data );
		const onDoneFn = () => { onDone(); cleanup(); };

		function cleanup () {
			ipcRenderer.removeListener( eventChannel, onEventFn );
			ipcRenderer.removeListener( errorChannel, onErrorFn );
			ipcRenderer.removeListener( doneChannel, onDoneFn );
		}

		ipcRenderer.on( eventChannel, onEventFn );
		ipcRenderer.on( errorChannel, onErrorFn );
		ipcRenderer.on( doneChannel, onDoneFn );

		ipcRenderer.invoke( 'ai:chat-completion-stream', { requestId, provider, payload } );

		// returns an unsubscribe fn used for cancellation (doc 06 §7)
		return () => {
			ipcRenderer.invoke( 'ai:cancel-stream', requestId );
			cleanup();
		};
	},
} );

