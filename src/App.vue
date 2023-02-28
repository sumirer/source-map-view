<template>
  <div class="title">
    <img src="./assets/log.svg" />
    SourceMap View.
  </div>
  <div class="info">
    网站可以使用打包产生的SourceMap文件进行错误回溯和错误追踪，在解析错误前，请导入对应的SourceMap文件，然后在错误中输入报错信息，即可得到完整的错误信息
    <br />
    打包产物可以参考webpack、vite或者其他打包工具的打包配置
  </div>
  <div class="message-box" :class="[{ show: showError }]">
    <div v-for="(error, index) in errorInfo" :key="index">{{ error }}</div>
  </div>
  <div class="flex-box">
    <div class="op-container">
      <span>Source Map: </span>
      <div style="width: 100%; overflow-x: auto">
        <div class="error-input">
          <div
            v-for="(consumer, fileName) in source.sourceMapRecord"
            :key="fileName"
          >
            {{ fileName }}.map
          </div>
        </div>
        <div class="upload-container">
          <input v-model="sourceFileUrl" class="url-input" placeholder="请输入SourceMap链接"/>
          <div class="upload-btn" @click="loadSourceFromUrl">从链接导入</div>
          <div class="upload-btn">
            从文件导入
            <input type="file" @change="handleFileChange" multiple />
          </div>
        </div>
      </div>
    </div>
    <div class="op-container">
      <span>错误信息: </span>
      <textarea
        class="error-input"
        v-model="errorMessage"
        placeholder="请粘贴错误信息"
      ></textarea>
    </div>
  </div>

  <button @click="parseResult">解析错误</button>
  <button @click="errorMessage = ''">清空错误内容</button>
  <button @click="source.sourceMapRecord = {}">清空SourceMap</button>
  <div>
    <div
      v-for="(source, index) in previewData"
      :key="index"
      class="preview-card"
    >
      <div v-if="index === 0" class="reason">Reason: {{ source.error }}</div>
      <div>{{ source.rawError }}</div>
      <div>
        {{ source.info.source }}?{{ source.info.line }}:{{ source.info.column }}
      </div>
      <pre
        :data-line="source.info.line"
        :data-line-offset="source.hightLineOffset"
        :data-start="source.hightLineOffset"
        class="language-typescript line-numbers"
      >
          <code v-html="source.source"/>
          </pre>
    </div>
  </div>
</template>

<script lang="ts">
import { NullableMappedPosition } from "source-map";
import { defineComponent, nextTick } from "vue";
import SourceMapParser from "./source";
import Prism from "prismjs";
import "prismjs/themes/prism.css";

export default defineComponent({
  name: "App",
  data: () => {
    return {
      source: new SourceMapParser(),
      focusIndex: -1,
      errorMessage: "",
      sourceFileUrl: "",
      previewData: [] as Array<{
        source: string;
        info: NullableMappedPosition;
        error: string;
        hightLineOffset: string | number;
        rawError: string;
      }>,
      showError: false,
      errorInfo: [] as string[],
    };
  },
  created() {
    this.source.initSourceMap();
  },
  methods: {
    loadSourceFromUrl() {
      if (this.sourceFileUrl.startsWith("http")) {
        this.source
          .loadSourceFile(this.sourceFileUrl)
          .then(() => {
            this.sourceFileUrl = "";
          })
          .catch(() => {
            this.showErrorMessage([`Url: ${this.sourceFileUrl} load error..`]);
          });
      }
    },
    async handleFileChange(event: Event) {
      const target = event.target as HTMLInputElement;
      const files = target.files || [];
      const error: string[] = [];
      for await (const file of files) {
        try {
          await this.source.loadSourceFileData(file);
        } catch (e) {
          error.push(`File: ${file.name} load error..`);
          continue;
        }
      }
      if (error.length > 0) {
        console.log(error);
        this.showErrorMessage(error);
      }
      target.files = null;
      target.value = "";
    },
    showErrorMessage(info: string[]) {
      this.errorInfo = info;
      this.showError = true;
      setTimeout(() => {
        this.showError = false;
      }, 2500);
    },
    loadSourceFile(
      fileName: string,
      line: number,
      column: number,
      callback: (source: string, info: NullableMappedPosition) => void
    ) {
      const consumer = this.source.getSourceMapConsumer(fileName);
      if (!consumer) {
        callback("", {} as NullableMappedPosition);
        return;
      }
      const result = consumer.originalPositionFor({
        line: line,
        column: column,
      });
      if (result.source) {
        const source = consumer.sourceContentFor(result.source);
        callback(source || "", result);
      }
    },
    getErrorStack(errorMessage: string) {
      const errorData = errorMessage.split("\n");
      let errorStack = "";
      if (errorData.length > 2) {
        errorStack = errorData[1];
      }
      let callStack = "";
      if (errorData.length > 3) {
        callStack = errorData.slice(2).join("\n");
      }
      const result = callStack.matchAll(/at.*\((.*).js:(.*):(.*)\)/g);
      if (errorData.length === 1) {
        errorStack = errorData[0];
      }
      return {
        error: errorData[0],
        errorPosition: errorStack.match(/at (.*).js:(.*):(.*)/),
        result,
      };
    },
    parseResult() {
      this.previewData = [];
      const stacks = this.getErrorStack(this.errorMessage);
      const composeError = [stacks.errorPosition, ...stacks.result].filter(
        Boolean
      );
      for (const stack of composeError as RegExpMatchArray[]) {
        this.loadSourceFile(
          stack[1],
          Number(stack[2]),
          Number(stack[3]),
          (source, info) => {
            if (source) {
              const { hightLineOffset, sourceData } = this.getErrorContent(
                source,
                info
              );
              this.previewData.push({
                source: sourceData,
                info,
                error: stacks.error,
                rawError: stack[0],
                hightLineOffset,
              });
            } else {
              this.previewData.push({
                source: "未找到指定SourceMap文件",
                info,
                error: stacks.error,
                rawError: stack[0],
                hightLineOffset: 0,
              });
            }
          }
        );
      }
      nextTick(() => {
        Prism.highlightAll();
      });
    },
    getErrorContent(source: string, info: NullableMappedPosition) {
      const sourceData = source.split("\n");
      const code = sourceData.slice(
        Math.max(0, (info.line as number) - 6),
        Math.min(source.length, (info.line as number) + 6)
      );
      code.unshift("");
      return {
        sourceData: Prism.highlight(
          code.join("\n"),
          Prism.languages.typescript,
          "ts"
        ),
        hightLineOffset: Math.max(0, (info.line as number) - 6),
      };
    },
  },
});
</script>

<style>
body {
  margin: 0;
  padding: 0;
  color: #333;
}
html {
  margin: 0;
  padding: 0;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #e6eef4;
  position: absolute;
  height: 100%;
  width: 100%;
  overflow: auto;
  padding: 1rem;
  box-sizing: border-box;
}

pre {
  margin: 5px 0;
}
.line-highlight {
  background: rgba(255, 0, 0, 0.28) !important;
}
.line-numbers .line-numbers-rows {
  left: -9.2em !important;
}
.error-input {
  width: 100%;
  height: 200px;
  resize: none;
  outline: none;
  border: unset;
  padding: 10px;
  box-sizing: border-box;
  border-radius: 8px;
  border-radius: 20px;
  border-radius: 20px;
  background: #e6eef4;
  box-shadow: inset 8px 8px 9px #cfd6dc, inset -8px -8px 9px #fdffff;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 14px;
}

.url-input {
  width: 100%;
  height: 30px;
  resize: none;
  outline: none;
  border: unset;
  padding: 0 3px;
  box-sizing: border-box;
  border-radius: 4px;
  background: #e6eef4;
  box-shadow: inset 7px 7px 4px #dde4ea, inset -7px -7px 4px #eff8fe;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 14px;
}

.flex-box {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}

.op-container {
  width: 100%;
  min-width: 400px;
  font-size: 14px;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  margin: 10px 0;
  flex: 1;
  border-radius: 20px;
  background: #e6eef4;
  box-shadow: 15px 15px 30px #cfd6dc, -15px -15px 30px #fdffff;
  padding: 14px;
}

.op-container:first-child {
  margin-right: 20px;
}

.op-container > span {
  margin-right: 5px;
  flex: none;
  font-weight: bold;
  line-height: 40px;
}

button {
  color: #090909;
  padding: 0.7em 1.7em;
  font-size: 18px;
  border-radius: 0.5em;
  background: #e6eef4;
  border: 1px solid #e6eef4;
  transition: all 0.3s;
  box-shadow: 6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff;
  margin-right: 20px;
  font-size: 14px;
  font-weight: bold;
}

button:hover {
  border: 1px solid white;
}

button:active {
  box-shadow: 4px 4px 12px #c5c5c5, -4px -4px 12px #ffffff;
}

.preview-card {
  border-radius: 20px;
  background: #e6eef4;
  box-shadow: 15px 15px 12px #cfd6dc, -15px -15px 12px #fdffff;
  padding: 14px;
  margin-top: 20px;
}

.reason {
  font-weight: bold;
}

.upload-btn {
  width: 100px;
  text-align: center;
  height: 30px;
  font-weight: bold;
  line-height: 30px;
  border-radius: 8px;
  position: relative;
  border-radius: 8px;
  background: #e6eef4;
  box-shadow: -7px 2px 8px #d1d9de, -7px -7px 8px #fbffff;
  display: inline-block;
  margin-left: 18px;
  flex: none;
  font-size: 14px;
  box-sizing: border-box;
  cursor: pointer;
}

.upload-btn > input {
  opacity: 0;
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 2;
  left: 0;
}

.upload-container {
  display: flex;
  align-items: center;
  padding: 10px 0;
}

.title {
  font-size: 18px;
  font-weight: bold;
  padding: 10px 14px;
  border-radius: 13px;
  background: #e6eef4;
  box-shadow: 7px 7px 14px #c1c8cd, -7px -7px 14px #ffffff;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

.title img {
  width: 24px;
  margin-right: 20px;
}

.info {
  font-size: 14px;
  padding: 10px 14px;
  border-radius: 13px;
  background: #e6eef4;
  box-shadow: 7px 7px 14px #c1c8cd, -7px -7px 14px #ffffff;
  margin-bottom: 10px;
  color: #999;
}
.message-box {
  position: fixed;
  z-index: 999;
  width: 400px;
  min-height: 30px;
  border-radius: 13px;
  background: #e6eef4;
  box-shadow: 7px 7px 14px #c1c8cd, -7px -7px 14px #ffffff;
  left: 50%;
  top: -100%;
  transform: translateX(-200px);
  transition: top 0.2s ease-in-out;
  font-size: 14px;
  color: red;
  padding: 20px;
}

.message-box.show {
  top: 40px;
}
</style>
