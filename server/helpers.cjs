"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                  ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.onGenerationComplete =
  exports.executeGenerationRequest =
  exports.buildGenerationRequest =
  exports.isNSFWFilteredArtifact =
  exports.isImageArtifact =
    void 0;
var Generation = require("./generation/generation_pb.cjs");
var fs = require("fs");
var isImageArtifact = function (artifact) {
  return (
    artifact.getType() === Generation.ArtifactType.ARTIFACT_IMAGE &&
    artifact.getFinishReason() === Generation.FinishReason.NULL &&
    artifact.hasBinary()
  );
};
exports.isImageArtifact = isImageArtifact;
var isNSFWFilteredArtifact = function (artifact) {
  return (
    artifact.getType() === Generation.ArtifactType.ARTIFACT_IMAGE &&
    artifact.getFinishReason() === Generation.FinishReason.FILTER
  );
};
exports.isNSFWFilteredArtifact = isNSFWFilteredArtifact;
/** Builds a generation request for a specified engine with the specified parameters. */
function buildGenerationRequest(engineID, params) {
  if (params.type === "upscaling") {
    var request_1 = new Generation.Request();
    request_1.setEngineId(engineID);
    request_1.setRequestedType(Generation.ArtifactType.ARTIFACT_IMAGE);
    request_1.setClassifier(new Generation.ClassifierParameters());
    var imageParams_1 = new Generation.ImageParameters();
    if ("width" in params && !!params.width) {
      imageParams_1.setWidth(params.width);
    } else if ("height" in params && !!params.height) {
      imageParams_1.setHeight(params.height);
    }
    request_1.setImage(imageParams_1);
    request_1.addPrompt(createInitImagePrompt(params.initImage));
    return request_1;
  }
  var imageParams = new Generation.ImageParameters();
  if (params.type === "text-to-image") {
    params.width && imageParams.setWidth(params.width);
    params.height && imageParams.setHeight(params.height);
  }
  // Set the number of images to generate (Default 1)
  params.samples && imageParams.setSamples(params.samples);
  // Set the steps (Default 30)
  // Represents the amount of inference steps performed on image generation.
  params.steps && imageParams.setSteps(params.steps);
  // Set the seed (Default 0)
  // Including a seed will cause the results to be deterministic.
  // Omitting the seed or setting it to `0` will do the opposite.
  params.seed && imageParams.addSeed(params.seed);
  // Set the sampler (Default 'automatic')
  // Omitting this value enables 'automatic' mode where we choose the best sampler for you based
  // on the current payload. For example, since CLIP guidance only works on ancestral samplers,
  // when CLIP guidance is enabled, we will automatically choose an ancestral sampler for you.
  if (params.sampler) {
    var transformType = new Generation.TransformType();
    transformType.setDiffusion(params.sampler);
    imageParams.setTransform(transformType);
  }
  // Set the Engine
  // At the time of writing, valid engines are:
  //  stable-diffusion-v1,
  //  stable-diffusion-v1-5
  //  stable-diffusion-512-v2-0
  //  stable-diffusion-768-v2-0
  //  stable-diffusion-512-v2-1
  //  stable-diffusion-768-v2-1
  //  stable-inpainting-v1-0
  //  stable-inpainting-512-v2-0
  //  stable-diffusion-xl-beta-v2-2-2
  //  esrgan-v1-x2plus
  var request = new Generation.Request();
  request.setEngineId(engineID);
  request.setRequestedType(Generation.ArtifactType.ARTIFACT_IMAGE);
  request.setClassifier(new Generation.ClassifierParameters());
  // Set the CFG scale (Default 7)
  // Influences how strongly your generation is guided to match your prompt.  Higher values match closer.
  var samplerParams = new Generation.SamplerParameters();
  params.cfgScale && samplerParams.setCfgScale(params.cfgScale);
  var stepParams = new Generation.StepParameter();
  stepParams.setScaledStep(0);
  stepParams.setSampler(samplerParams);
  var scheduleParams = new Generation.ScheduleParameters();
  if (params.type === "image-to-image") {
    // If we're doing image-to-image generation then we need to configure
    // how much influence the initial image has on the diffusion process
    scheduleParams.setStart(params.stepScheduleStart);
    if (params.stepScheduleEnd) {
      scheduleParams.setEnd(params.stepScheduleEnd);
    }
  } else if (params.type === "image-to-image-masking") {
    // Step schedule start is always 1 for masking requests
    scheduleParams.setStart(1);
  }
  stepParams.setSchedule(scheduleParams);
  // Set CLIP Guidance (Default: None)
  // NOTE: This only works with ancestral samplers. Omitting the sampler parameter above will ensure
  // that we automatically choose an ancestral sampler for you when CLIP guidance is enabled.
  if (params.clipGuidancePreset) {
    var guidanceParameters = new Generation.GuidanceParameters();
    guidanceParameters.setGuidancePreset(params.clipGuidancePreset);
    stepParams.setGuidance(guidanceParameters);
  }
  imageParams.addParameters(stepParams);
  request.setImage(imageParams);
  params.prompts.forEach(function (textPrompt) {
    var prompt = new Generation.Prompt();
    prompt.setText(textPrompt.text);
    // If provided, set the prompt's weight (use negative values for negative weighting)
    if (textPrompt.weight) {
      var promptParameters = new Generation.PromptParameters();
      promptParameters.setWeight(textPrompt.weight);
      prompt.setParameters(promptParameters);
    }
    request.addPrompt(prompt);
  });
  // Add image prompts if we're doing some kind of image-to-image generation or upscaling
  if (params.type === "image-to-image") {
    request.addPrompt(createInitImagePrompt(params.initImage));
  } else if (params.type === "image-to-image-masking") {
    request.addPrompt(createInitImagePrompt(params.initImage));
    request.addPrompt(createMaskImagePrompt(params.maskImage));
  }
  return request;
}
exports.buildGenerationRequest = buildGenerationRequest;
function createInitImagePrompt(imageBinary) {
  var initImageArtifact = new Generation.Artifact();
  initImageArtifact.setBinary(imageBinary);
  initImageArtifact.setType(Generation.ArtifactType.ARTIFACT_IMAGE);
  var initImageParameters = new Generation.PromptParameters();
  initImageParameters.setInit(true);
  var initImagePrompt = new Generation.Prompt();
  initImagePrompt.setParameters(initImageParameters);
  initImagePrompt.setArtifact(initImageArtifact);
  return initImagePrompt;
}
function createMaskImagePrompt(imageBinary) {
  var maskImageArtifact = new Generation.Artifact();
  maskImageArtifact.setBinary(imageBinary);
  maskImageArtifact.setType(Generation.ArtifactType.ARTIFACT_MASK);
  var maskImagePrompt = new Generation.Prompt();
  maskImagePrompt.setArtifact(maskImageArtifact);
  return maskImagePrompt;
}
/** Executes a GenerationRequest, abstracting the gRPC streaming result behind a Promise */
function executeGenerationRequest(generationClient, request, metadata) {
  return __awaiter(this, void 0, void 0, function () {
    var stream_1, answers, err_1;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          _a.trys.push([0, 2, , 3]);
          stream_1 = generationClient.generate(request, metadata);
          return [
            4 /*yield*/,
            new Promise(function (resolve, reject) {
              var answers = new Array();
              stream_1.on("data", function (data) {
                return answers.push(data);
              });
              stream_1.on("end", function () {
                return resolve(answers);
              });
              stream_1.on("status", function (status) {
                if (status.code === 0) return;
                reject(status.details);
              });
            }),
          ];
        case 1:
          answers = _a.sent();
          return [2 /*return*/, extractArtifacts(answers)];
        case 2:
          err_1 = _a.sent();
          return [
            2 /*return*/,
            err_1 instanceof Error ? err_1 : new Error(JSON.stringify(err_1)),
          ];
        case 3:
          return [2 /*return*/];
      }
    });
  });
}
exports.executeGenerationRequest = executeGenerationRequest;
function extractArtifacts(answers) {
  var imageArtifacts = new Array();
  var filteredArtifacts = new Array();
  for (var _i = 0, answers_1 = answers; _i < answers_1.length; _i++) {
    var answer = answers_1[_i];
    for (var _a = 0, _b = answer.getArtifactsList(); _a < _b.length; _a++) {
      var artifact = _b[_a];
      if ((0, exports.isImageArtifact)(artifact)) {
        imageArtifacts.push(artifact);
      } else if ((0, exports.isNSFWFilteredArtifact)(artifact)) {
        filteredArtifacts.push(artifact);
      }
    }
  }
  return {
    filteredArtifacts: filteredArtifacts,
    imageArtifacts: imageArtifacts,
  };
}
/** Generation completion handler - replace this with your own logic  */
function onGenerationComplete(response) {
  if (response instanceof Error) {
    console.error("Generation failed", response);
    throw response;
  }
  console.log(
    ""
      .concat(response.imageArtifacts.length, " image")
      .concat(
        response.imageArtifacts.length > 1 ? "s" : "",
        " were successfully generated."
      )
  );
  // Do something with NSFW filtered artifacts
  if (response.filteredArtifacts.length > 0) {
    console.log(
      "".concat(response.filteredArtifacts.length, " artifact") +
        "".concat(response.filteredArtifacts.length > 1 ? "s" : "") +
        " were filtered by the NSFW classifier and need to be retried."
    );
  }
  // Do something with the successful image artifacts
  response.imageArtifacts.forEach(function (artifact) {
    try {
      fs.writeFileSync(
        "image-".concat(artifact.getSeed(), ".png"),
        Buffer.from(artifact.getBinary_asU8())
      );
    } catch (error) {
      console.error("Failed to write resulting image to disk", error);
    }
  });
  // For browser implementations: you could use the `artifact.getBinary_asB64()` method to get a
  // base64 encoded string and then create a data URL from that and display it in an <img> tag.
}
exports.onGenerationComplete = onGenerationComplete;
