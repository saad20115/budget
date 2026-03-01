    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto" dir="rtl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">إدارة واستيراد المصاريف</h1>
                <p className="text-gray-500 mt-1">قم بتحديد التصنيف ثم ارفع ملفات الإكسل (سيتم التوزيع التلقائي بناءً على نسب قيم المشاريع).</p>
            </div>

            {/* Category Selector */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6 flex flex-col md:flex-row gap-4 max-w-4xl mx-auto">
                <div className="flex-1">
                    <label className="block text-gray-700 font-semibold mb-2">اختر مجموعة المشاريع لتوزيع التكاليف عليها</label>
                    <select
                        value={selectedCategory}
                        onChange={e => { setSelectedCategory(e.target.value); setSelectedProject('all'); }}
                        title="تصنيف المشاريع"
                        className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">-- اضغط لاختيار المجموعة --</option>
                        <option value="مشاريع الحج">مشاريع الحج</option>
                        <option value="المجلس التنسيقي">المجلس التنسيقي</option>
                    </select>
                </div>

                {selectedCategory && availableProjects.length > 0 && (
                    <div className="flex-1">
                        <label className="block text-gray-700 font-semibold mb-2">تصفية حسب المشروع</label>
                        <select
                            value={selectedProject}
                            onChange={e => setSelectedProject(e.target.value)}
                            title="المشروع"
                            className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="all">-- جميع المشاريع --</option>
                            {availableProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Quick Add Section */}
            {selectedCategory && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6 max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                        <div className="bg-blue-50 p-2 rounded-xl text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">إضافة بند سريع</h2>
                        <p className="text-sm text-gray-500 mr-auto">إضافة مباشرة دون الحاجة لملف إكسل</p>
                    </div>

                    <form onSubmit={handleQuickAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">

                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 text-sm">نوع الإضافة</label>
                            <select
                                value={quickAddType}
                                onChange={e => setQuickAddType(e.target.value as 'target' | 'actual')}
                                className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 focus:border-blue-500 focus:outline-none text-sm"
                            >
                                <option value="target">بند موازنة مستهدفة</option>
                                <option value="actual">مصروف فعلي</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 text-sm">المشروع <span className="text-red-500">*</span></label>
                            <select
                                value={quickAddProject}
                                onChange={e => setQuickAddProject(e.target.value)}
                                required
                                className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 focus:border-blue-500 focus:outline-none text-sm"
                            >
                                <option value="">-- اختر المشروع --</option>
                                {availableProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 text-sm">البند المالي <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={quickAddName}
                                onChange={e => setQuickAddName(e.target.value)}
                                list="quick-add-names"
                                required
                                placeholder={quickAddType === 'target' ? "اسم البند المستهدف" : "اسم البند (لربط الموازنة)"}
                                className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 focus:border-blue-500 focus:outline-none text-sm"
                            />
                            <datalist id="quick-add-names">
                                {Array.from(new Set(targetExpenses.filter(e => e.project_id === quickAddProject).map(e => e.name))).map((n, i) => (
                                    <option key={i} value={n} />
                                ))}
                            </datalist>
                        </div>

                        <div>
                            <label className="block text-gray-700 font-semibold mb-2 text-sm">المبلغ (ر.س) <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={quickAddAmount}
                                onChange={e => setQuickAddAmount(e.target.value)}
                                required
                                placeholder="0.00"
                                className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 focus:border-blue-500 focus:outline-none text-sm"
                            />
                        </div>

                        {quickAddType === 'actual' && (
                            <>
                                <div>
                                    <label className="block text-gray-700 font-semibold mb-2 text-sm">تاريخ الصرف <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        value={quickAddDate}
                                        onChange={e => setQuickAddDate(e.target.value)}
                                        required={quickAddType === 'actual'}
                                        className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 focus:border-blue-500 focus:outline-none text-sm"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="block text-gray-700 font-semibold mb-2 text-sm">ملاحظات</label>
                                    <input
                                        type="text"
                                        value={quickAddNotes}
                                        onChange={e => setQuickAddNotes(e.target.value)}
                                        placeholder="ملاحظات اختيارية..."
                                        className="w-full h-11 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 focus:border-blue-500 focus:outline-none text-sm"
                                    />
                                </div>
                            </>
                        )}

                        <div className={quickAddType === 'target' ? 'col-span-1 md:col-span-2 lg:col-span-4 mt-2' : 'col-span-1 md:col-span-2 mt-2'}>
                            <Button
                                type="submit"
                                disabled={loadingQuickAdd}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-full h-11 text-sm font-semibold shadow-sm"
                            >
                                {loadingQuickAdd ? 'جارٍ الإضافة...' : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 inline-block"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                                        إضافة {quickAddType === 'target' ? 'بند موازنة' : 'مصروف فعلي'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {message && (
                <div className={`p-4 rounded-xl mb-6 font-medium max-w-4xl mx-auto ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {/* Target Expenses Upload */}
                <Card className="border-gray-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <CardHeader>
                        <CardTitle className="text-gray-900 text-lg flex justify-between items-center">
                            <span>استيراد وتوزيع الموازنة المستهدفة</span>
                            <span className="text-2xl text-blue-500 bg-blue-50 p-2 rounded-xl">🎯</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            ارفع ملف إكسل لإنشاء بنود الموازنة وتوزيعها. <br />
                            <strong className="text-gray-900">ترتيب الأعمدة المطلوبة:</strong>
                            <br />1. بند المصروف
                            <br />2. سعر البند (اختياري)
                            <br />3. العدد (اختياري)
                            <br />4. الإجمالي
                        </p>

                        <div className="pt-4 flex items-center gap-3">
                            <Button asChild disabled={loadingTargets} className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer relative">
                                <label>
                                    {loadingTargets ? 'جارٍ العمل...' : 'اختيار ملف إكسل'}
                                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleTargetImport} />
                                </label>
                            </Button>
                            <Button
                                variant="outline"
                                onClick={downloadTargetTemplate}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                                تحميل قالب الموازنة
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Actual Expenses Upload */}
                <Card className="border-gray-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <CardHeader>
                        <CardTitle className="text-gray-900 text-lg flex justify-between items-center">
                            <span>استيراد وتوزيع المنصرف الفعلي</span>
                            <span className="text-2xl text-emerald-500 bg-emerald-50 p-2 rounded-xl">💸</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            ارفع ملف إكسل الدفعات المنصرفة لتوزيعها. <br />
                            <strong className="text-gray-900">ترتيب الأعمدة المطلوبة:</strong>
                            <br />1. اسم البند (لربطه بالموازنة)
                            <br />2. المبلغ الإجمالي الفعلي
                            <br />3. تاريخ الصرف (YYYY-MM-DD)
                            <br />4. ملاحظات
                        </p>

                        <div className="pt-4 flex items-center gap-3">
                            <Button asChild disabled={loadingActuals} className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer relative">
                                <label>
                                    {loadingActuals ? 'جارٍ العمل...' : 'اختيار ملف إكسل'}
                                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleActualImport} />
                                </label>
                            </Button>
                            <Button
                                variant="outline"
                                onClick={downloadActualTemplate}
                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                                تحميل قالب المصاريف
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Render tables if a category is selected */}
            {selectedCategory && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    {/* Target Expenses Table */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[500px]">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-gray-900 font-semibold">باقي عمليات موازنة المجموعة</h3>
                            <span className="text-sm text-gray-500 bg-white px-2.5 py-1 rounded-full border">{filteredTargetExpenses.length} عملية</span>
                        </div>
                        <div className="overflow-y-auto flex-1 p-0">
                            {loadingData ? (
                                <p className="text-center text-gray-400 py-12">جارٍ التحميل...</p>
                            ) : filteredTargetExpenses.length === 0 ? (
                                <p className="text-center text-gray-400 py-12">لا توجد بنود موازنة مسجلة</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white shadow-sm">
                                        <tr className="border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">
                                            <th className="text-right px-5 py-3">المشروع</th>
                                            <th className="text-right px-5 py-3">اسم البند</th>
                                            <th className="text-left px-5 py-3">القيمة المخصصة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTargetExpenses.map((exp, i) => (
                                            <tr key={exp.id || i} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                <td className="px-5 py-3 text-gray-900 text-xs w-1/3 truncate max-w-[120px]" title={exp.projects?.name}>{exp.projects?.name}</td>
                                                <td className="px-5 py-3 text-gray-700">{exp.name}</td>
                                                <td className="px-5 py-3 text-left font-medium text-blue-600">{Number(exp.target_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Actual Expenses Table */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[500px]">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-gray-900 font-semibold">باقي عمليات الصرف للمجموعة</h3>
                            <span className="text-sm text-gray-500 bg-white px-2.5 py-1 rounded-full border">{filteredActualExpenses.length} عملية</span>
                        </div>
                        <div className="overflow-y-auto flex-1 p-0">
                            {loadingData ? (
                                <p className="text-center text-gray-400 py-12">جارٍ التحميل...</p>
                            ) : filteredActualExpenses.length === 0 ? (
                                <p className="text-center text-gray-400 py-12">لا توجد مصاريف فعلية مسجلة</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white shadow-sm">
                                        <tr className="border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">
                                            <th className="text-right px-5 py-3">التاريخ</th>
                                            <th className="text-right px-5 py-3">المشروع</th>
                                            <th className="text-left px-5 py-3">المبلغ المحمل</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredActualExpenses.map((act, i) => (
                                            <tr key={act.id || i} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                <td className="px-5 py-3 text-gray-600 whitespace-nowrap flex flex-col gap-1">
                                                    <span>{act.expense_date}</span>
                                                    <span className="text-gray-400 text-[10px]" title={act.project_expenses?.name || act.project_staffing?.role_name || act.notes || ''}>
                                                        {act.project_expenses?.name || act.project_staffing?.role_name || act.notes || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-gray-900 text-xs w-1/3 truncate max-w-[120px]" title={act.projects?.name}>{act.projects?.name}</td>
                                                <td className="px-5 py-3 text-left font-medium text-emerald-600 whitespace-nowrap">{Number(act.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
