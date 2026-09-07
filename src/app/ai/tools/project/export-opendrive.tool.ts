import { AiTool, AiToolContext, AiToolRunResult } from '../../models/ai-tool.model';
import { ExporterService } from 'app/services/exporter.service';

export class ExportOpendriveTool implements AiTool {
	name = 'export_opendrive';
	description = 'Export the current map to an OpenDRIVE (.xodr) file. Use only when the user explicitly asks to export/save/download the file.';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'project';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {},
		required: []
	};

	constructor(private exporterService: ExporterService) {}

	validate(args: any, ctx: AiToolContext): void {}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		const roads = ctx.mapService.map.getRoads();
		if (roads.length === 0) {
			return {
				summary: 'Nothing to export: The map has no roads.',
				commands: []
			};
		}

		this.exporterService.exportOpenDrive();

		return {
			summary: 'Triggered OpenDRIVE export.',
			commands: []
		};
	}
}
