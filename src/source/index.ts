import {
  BasicSourceMapConsumer,
  RawSourceMap,
  SourceMapConsumer,
} from "source-map";
import { reactive } from "vue";

export default class SourceMapParser {
  public sourceMapRecord: Record<string, BasicSourceMapConsumer> = reactive({});

  public async loadSourceFile(fileUrl: string): Promise<void> {
    const resp = await fetch(fileUrl);
    const result = await resp.json();
    const sourceData = result as unknown as RawSourceMap;
    const consumer = await new SourceMapConsumer(sourceData);
    this.sourceMapRecord[sourceData.file.split("/").pop() || ""] = consumer;
  }

  public async loadSourceFileData(file: File): Promise<void> {
    const sourceData = JSON.parse(await file.text());
    const consumer = await new SourceMapConsumer(sourceData);
    this.sourceMapRecord[sourceData.file.split("/").pop() || ""] = consumer;
  }

  public initSourceMap(): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    SourceMapConsumer.initialize({
      "lib/mappings.wasm":
        "https://unpkg.com/source-map@0.7.3/lib/mappings.wasm",
    });
  }

  public getSourceMapConsumer(fileName: string): BasicSourceMapConsumer {
    console.log(fileName, this.sourceMapRecord);
    return this.sourceMapRecord[fileName + ".js"];
  }
}
