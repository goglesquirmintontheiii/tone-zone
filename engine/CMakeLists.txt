cmake_minimum_required(VERSION 3.16)
project(tonezone_engine CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

set(TZ_ARCH "x86-64-v2" CACHE STRING "x86-64 micro-architecture level (x86-64-v2 / x86-64-v3)")
# ARM (Raspberry Pi): one aarch64 binary for Pi 3B / 3B+ (A53), Pi 4 (A72) and Pi 5 (A76). A53 code runs on all of
# them; NEON is always on for aarch64 and Eigen picks it up by itself.
set(TZ_CPU "cortex-a53" CACHE STRING "ARM -mcpu value (aarch64 / armhf builds only)")
if(CMAKE_SYSTEM_PROCESSOR MATCHES "^(aarch64|arm64|ARM64)$")
  # -fsigned-char: x86 semantics for plain char (WDL in NAM asserts it, and it keeps output identical)
  set(TZ_ARCH_FLAGS -mcpu=${TZ_CPU} -fsigned-char)
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "^arm")
  # 32-bit Pi OS (armhf): best effort, the 64-bit OS is the supported target
  set(TZ_ARCH_FLAGS -mcpu=${TZ_CPU} -mfpu=neon-fp-armv8 -mfloat-abi=hard -fsigned-char)
else()
  set(TZ_ARCH_FLAGS -march=${TZ_ARCH} -mtune=generic)
endif()

set(NAM_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/NeuralAmpModelerCore)
file(GLOB NAM_SOURCES ${NAM_DIR}/NAM/*.cpp ${NAM_DIR}/NAM/*/*.cpp)
file(GLOB TZ_SOURCES src/*.cpp src/dsp/*.cpp src/blocks/*.cpp)

add_executable(tonezone-engine ${TZ_SOURCES} ${NAM_SOURCES})
target_include_directories(tonezone-engine PRIVATE
  src
  ${NAM_DIR}
  ${NAM_DIR}/NAM
  ${NAM_DIR}/Dependencies/nlohmann
  ${NAM_DIR}/Dependencies/AudioDSPTools/dsp
  ${CMAKE_CURRENT_SOURCE_DIR}/third_party
  ${CMAKE_CURRENT_SOURCE_DIR}/third_party/signalsmith-stretch)
target_include_directories(tonezone-engine SYSTEM PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/third_party/eigen)
target_compile_definitions(tonezone-engine PRIVATE NAM_SAMPLE_FLOAT NAM_ENABLE_A2_FAST EIGEN_NO_DEBUG)
target_compile_options(tonezone-engine PRIVATE -O3 ${TZ_ARCH_FLAGS} -fno-math-errno -ffp-contract=fast -Wno-deprecated-declarations)
# GCC 11 (Ubuntu 22.04, used for the Pi build) rejects a type alias in the bundled NAM resampler header that newer
# compilers accept ("changes meaning of LanczosResampler"); let it through for the one file that includes it
if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU" AND CMAKE_CXX_COMPILER_VERSION VERSION_LESS 13)
  set_source_files_properties(src/blocks/nam.cpp PROPERTIES COMPILE_OPTIONS "-fpermissive")
endif()
target_link_options(tonezone-engine PRIVATE -static-libstdc++ -static-libgcc)
target_link_libraries(tonezone-engine PRIVATE dl pthread)
