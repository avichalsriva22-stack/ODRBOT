/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Asset } from "app/assets/asset.model";
import { Log } from "app/core/utils/log";
import { PointerEventData } from "app/events/pointer-event-data";
import { SnackBar } from "app/services/snack-bar.service";
import { AssetHandler } from "../core/interfaces/asset-handler";
import { AppInjector } from "app/app.module";

export class AssetDropManager {

	private handlers: AssetHandler[] = [];

	constructor () {

		this.handlers = [];

	}

	addHandler ( handler: AssetHandler ): void {

		this.handlers.push( handler );

	}

	getHandler ( asset: Asset ): AssetHandler | null {

		for ( const handler of this.handlers ) {

			if ( handler.isAssetSupported( asset ) ) {

				return handler;

			}

		}

		return null;

	}

	isAssetSupported ( asset: Asset ): boolean {

		for ( const handler of this.handlers ) {

			if ( handler.isAssetSupported( asset ) ) {

				return true;

			}
		}

		return false;
	}

	handleAssetDroppedEvent ( asset: Asset, event: PointerEventData ): void {

		try {

			if ( !this.canDropAsset( asset, event ) ) {
				return;
			}

			this.getHandler( asset )?.onAssetDropped( asset, event );

		} catch ( error ) {

			AppInjector?.get( SnackBar )?.error( "Something went wrong while importing asset" );

			Log.error( error );

		}

	}

	handleAssetDragOverEvent ( asset: Asset, event: PointerEventData ): void {

		if ( !this.canDropAsset( asset, event ) ) {
			return;
		}

		this.getHandler( asset )?.onAssetDragOver( asset, event );

	}

	canDropAsset ( asset: Asset, event: PointerEventData ): boolean {

		if ( !this.isAssetSupported( asset ) ) {
			AppInjector?.get( SnackBar )?.warn( `Asset type: ${ asset.getTypeAsString() } not supported in this tool` );
			return false;
		}

		if ( !this.getHandler( asset )?.isLocationValid( asset, event ) ) {
			AppInjector?.get( SnackBar )?.warn( `Asset: ${ asset.getTypeAsString() } cannot be dropped at this location` );
			return false;
		}

		return true;
	}

}
