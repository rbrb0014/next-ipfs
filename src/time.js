export class TimeMeasureService {
  measureExecutionTime(func) {
    const start = Date.now();
    const result = func(); // 함수를 실행하고 결과를 저장합니다.
    const end = Date.now();
    const elapsed = end - start;

    console.log(`${func.name} 실행 시간: ${elapsed}ms`);
    return result; // 함수의 결과를 반환합니다.
  }
  async measureExecutionTimeAsync(func) {
    const start = Date.now();
    const result = await func(); // 함수를 실행하고 결과를 저장합니다.
    const end = Date.now();
    const elapsed = end - start;

    console.log(`${func.name} 실행 시간: ${elapsed}ms`);
    return result; // 함수의 결과를 반환합니다.
  }
}
