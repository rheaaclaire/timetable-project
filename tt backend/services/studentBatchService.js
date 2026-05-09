function generateBatches(studentCount = 50) {
  const studentsPerBatch = Math.ceil(studentCount / 3);

  return {
    batch1: studentsPerBatch,
    batch2: studentsPerBatch,
    batch3: studentCount - (studentsPerBatch * 2)
  };
}

module.exports = { generateBatches };