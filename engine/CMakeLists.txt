cmake_minimum_required(VERSION 3.16)
project(tonezone_engine CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

set(TZ_ARCH "x86-64-v2" CACHE STRING "x86-64 micro-architecture level (x86-64-v2 / x86-64-v3)")

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
target_compile_options(tonezone-engine PRIVATE -O3 -march=${TZ_ARCH} -mtune=generic -fno-math-errno -ffp-contract=fast -Wno-deprecated-declarations)
target_link_options(tonezone-engine PRIVATE -static-libstdc++ -static-libgcc)
target_link_libraries(tonezone-engine PRIVATE dl pthread)
