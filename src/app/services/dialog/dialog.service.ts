/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from '@angular/core';
import { TvElectronService } from '../tv-electron.service';
import { IFile } from 'app/io/file';
import { ProjectService } from '../editor/project.service';
import { FileUtils } from 'app/io/file-utils';

interface OpenDialogReturnValue {
	/**
	 * whether or not the dialog was canceled.
	 */
	canceled: boolean;
	/**
	 * An array of file paths chosen by the user. If the dialog is cancelled this will
	 * be an empty array.
	 */
	filePaths: string[];
	/**
	 * An array matching the `filePaths` array of base64 encoded strings which contains
	 * security scoped bookmark data. `securityScopedBookmarks` must be enabled for
	 * this to be populated. (For return values, see table here.)
	 *
	 * @platform darwin,mas
	 */
	bookmarks?: string[];
}

interface SaveDialogReturnValue {
	/**
		 * whether or not the dialog was canceled.
		 */
	canceled: boolean;
	/**
	 * An array of file paths chosen by the user. If the dialog is cancelled this will
	 * be an empty array.
	 */
	filePath: string;
	/**
	 * An array matching the `filePaths` array of base64 encoded strings which contains
	 * security scoped bookmark data. `securityScopedBookmarks` must be enabled for
	 * this to be populated. (For return values, see table here.)
	 *
	 * @platform darwin,mas
	 */
	bookmarks?: string[];

	directory?: string;

	filename?: string;
}

export interface IDialogProvider {

	openDialog ( options: any ): Promise<OpenDialogReturnValue>;

	saveDialog ( options: any ): Promise<SaveDialogReturnValue>;

}

@Injectable( {
	providedIn: 'root'
} )
export class DialogService {

	private dialogProvider: IDialogProvider;

	constructor (
		private electron: TvElectronService,
		private project: ProjectService,
	) {

		if ( this.electron.isElectronApp ) {

			this.dialogProvider = new ElectronDialogProvider( this.electron );

		} else {

			this.dialogProvider = new WebDialogProvider();

		}

	}

	openDialog ( options: any ): Promise<OpenDialogReturnValue> {

		return this.dialogProvider.openDialog( options );

	}

	saveDialog ( options: Electron.SaveDialogOptions ): Promise<SaveDialogReturnValue> {

		return this.dialogProvider.saveDialog( options );

	}

	async saveDialogSimple ( title: string, extension: string ): Promise<SaveDialogReturnValue> {

		const options = {
			defaultPath: this.project.projectPath,
			filters: [
				{ name: title, extensions: [ extension ] },
			],
		}

		const response = await this.saveDialog( options );

		if ( response.canceled ) return;

		if ( response.filePath == null ) return;

		const directory = FileUtils.getDirectoryFromPath( response.filePath );

		const filename = FileUtils.getFilenameFromPath( response.filePath );

		return { ...response, directory, filename };
	}

}

export class ElectronDialogProvider implements IDialogProvider {

	constructor (
		private electron: TvElectronService
	) {

	}

	openDialog ( options: any ): Promise<OpenDialogReturnValue> {

		const filters = options?.extensions?.map( ( extension: string ) => {
			return {
				name: extension,
				extensions: [ extension.replace( '.', '' ) ]
			}
		} );

		const openOptions = {
			title: options?.title || 'Select file',
			buttonLabel: options?.title || 'Import',
			filters: filters,
			message: options?.title || 'Select file'
		};

		return this.electron.remote.dialog.showOpenDialog( openOptions );

	}

	saveDialog ( options: Electron.SaveDialogOptions ): Promise<SaveDialogReturnValue> {

		const saveOptions: Electron.SaveDialogOptions = {
			title: 'Save File',
			defaultPath: options?.defaultPath || '',
			filters: options?.filters || [],
		};

		return this.electron.remote.dialog.showSaveDialog( saveOptions );

	}

}


export class WebDialogProvider implements IDialogProvider {

	constructor () {

	}

	openDialog ( options: any ): Promise<OpenDialogReturnValue> {

		return new Promise( ( resolve ) => {
			const input = document.createElement( 'input' );
			input.type = 'file';
			input.multiple = options?.properties?.includes( 'multiSelections' ) || false;
			
			if ( options?.extensions ) {
				input.accept = options.extensions.map( ( ext: string ) => `.${ext.replace( '.', '' )}` ).join( ',' );
			} else if ( options?.filters ) {
				const extensions = options.filters.flatMap( ( f: any ) => f.extensions ).map( ( ext: string ) => `.${ext}` );
				input.accept = extensions.join( ',' );
			}

			input.onchange = ( e: any ) => {
				const files = Array.from( e.target.files ) as File[];
				const filePaths = files.map( ( f: File ) => f.name ); 
				
				resolve( {
					canceled: false,
					filePaths: filePaths
				} );
			};

			input.oncancel = () => {
				resolve( { canceled: true, filePaths: [] } );
			};

			input.click();
		} );

	}

	saveDialog ( options: any ): Promise<SaveDialogReturnValue> {

		return new Promise( ( resolve ) => {
			const filename = window.prompt( 'Save file as:', options?.defaultPath || 'untitled' );
			if ( filename ) {
				resolve( { canceled: false, filePath: filename } );
			} else {
				resolve( { canceled: true, filePath: '' } );
			}
		} );

	}

}
