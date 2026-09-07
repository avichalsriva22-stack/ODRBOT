import { ExportOpendriveTool } from './export-opendrive.tool';
import { AiToolContext } from '../../models/ai-tool.model';
import { ExporterService } from 'app/services/exporter.service';
import { TvRoad } from 'app/map/models/tv-road.model';

describe('ExportOpendriveTool', () => {
	let tool: ExportOpendriveTool;
	let context: AiToolContext;
	let exporterService: jasmine.SpyObj<ExporterService>;

	beforeEach(() => {
		exporterService = jasmine.createSpyObj('ExporterService', ['exportOpenDrive']);
		tool = new ExportOpendriveTool(exporterService);
	});

	it('should return nothing to export if no roads', async () => {
		context = {
			mapService: {
				map: {
					getRoads: () => []
				}
			}
		} as any;

		const result = await tool.run({}, context);

		expect(result.summary).toContain('Nothing to export');
		expect(exporterService.exportOpenDrive).not.toHaveBeenCalled();
	});

	it('should trigger export if map has roads', async () => {
		context = {
			mapService: {
				map: {
					getRoads: () => [new TvRoad()]
				}
			}
		} as any;

		const result = await tool.run({}, context);

		expect(result.summary).toContain('Triggered OpenDRIVE export');
		expect(exporterService.exportOpenDrive).toHaveBeenCalled();
	});
});
