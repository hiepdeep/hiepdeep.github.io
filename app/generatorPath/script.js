console.clear();
document.addEventListener("DOMContentLoaded", () => {
	const svgElement = document.getElementById("svgElement");
	const sizeCircle = document.getElementById("size-circle");
	const sizePath = document.getElementById("size-path");
	const sizeGrid = document.getElementById("size-grid");
	const svg_width_input = document.getElementById("svg-width");
	const svg_height_input = document.getElementById("svg-height");
	const gridSpacingInput = document.getElementById("grid-spacing");
	const backgroundGrid = document.getElementById("background-grid");
	const dashedLineGroup = document.getElementById("dashed-line");
	const generatorPath = document.getElementById("generator-path");
	const draggableDotGroup = document.getElementById("draggable-dot");
	const showGridCheckbox = document.getElementById("show-grid");
	const showPointsCheckbox = document.getElementById("show-points");
	const closePathCheckbox = document.getElementById("close-path");
	const addPointButton = document.getElementById("add-point");
	const removePointButton = document.getElementById("remove-point");
	const resetPathButton = document.getElementById("reset-path");
	const textareaPathDiv = document.getElementById("textarea-path");
	const btnImport = document.getElementById("btn-import-path");
	const txtImport = document.getElementById("txt-import-path");
	let axis = [
		{
			type: "M",
			points: [{x: 1, y: 2}]
		},
		{
			type: "L",
			points: [{x: 2, y: 2}]
		},
		{
			type: "Q",
			points: [{x: 3, y: 3}, {x: 4, y: 2}]
		},
		{
			type: "C",
			points: [{x: 5, y: 1}, {x: 5, y: 3}, {x: 6, y: 2}]
		},
		{
			type: "L",
			points: [{x: 6, y: 5}]
		}
	];
	let currentDrag = null;
	const generatePathString = () => {
		let pathString = "";
		axis.forEach(segment => {
			const points = segment.points.map(p => `${p.x} ${p.y}`).join(", ");
			pathString += `${segment.type} ${points} `;
		});
		if (closePathCheckbox.checked) {
			pathString += "Z";
		}
		return pathString.trim();
	};
	const updateTextareaPath = () => {
		textareaPathDiv.innerHTML = "";
		axis.forEach(segment => {
			const span = document.createElement("span");
			span.className = segment.type;
			const points = segment.points.map(p => `${p.x} ${p.y}`).join(", ");
			span.textContent = `${segment.type} ${points}`;
			textareaPathDiv.appendChild(span);
			textareaPathDiv.appendChild(document.createTextNode(" "));
		});
		if (closePathCheckbox.checked) {
			const span = document.createElement("span");
			span.className = "Z";
			span.textContent = "Z";
			textareaPathDiv.appendChild(span);
		}
	};
	const updateGrid = () => {
		const width = parseFloat(svg_width_input.value);
		const height = parseFloat(svg_height_input.value);
		const spacing = parseFloat(gridSpacingInput.value);
		const gridStrokeWidth = parseFloat(sizeGrid.value);
		svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
		backgroundGrid.innerHTML = "";
		if (spacing > 0) {
			for (let x = spacing; x < width; x += spacing) {
				const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
				line.setAttribute("x1", x);
				line.setAttribute("y1", 0);
				line.setAttribute("x2", x);
				line.setAttribute("y2", height);
				line.setAttribute("stroke", "hsl(210deg 10% 95%)");
				line.setAttribute("stroke-width", gridStrokeWidth);
				backgroundGrid.appendChild(line);
			}
			for (let y = spacing; y < height; y += spacing) {
				const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
				line.setAttribute("x1", 0);
				line.setAttribute("y1", y);
				line.setAttribute("x2", width);
				line.setAttribute("y2", y);
				line.setAttribute("stroke", "hsl(210deg 10% 95%)");
				line.setAttribute("stroke-width", gridStrokeWidth);
				backgroundGrid.appendChild(line);
			}
		}
	};
	const updateDraggableDots = () => {
		const circleRadius = parseFloat(sizeCircle.value);
		draggableDotGroup.innerHTML = "";
		let pointIndex = 0;
		axis.forEach((segment, segmentIndex) => {
			const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
			group.setAttribute("data-point-title", segment.type);
			group.setAttribute("data-point-id", segmentIndex);
			segment.points.forEach((point, pIndex) => {
				const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
				circle.setAttribute("cx", point.x);
				circle.setAttribute("cy", point.y);
				circle.setAttribute("r", circleRadius);
				circle.setAttribute("fill", "#263238");
				circle.setAttribute("stroke", "white");
				circle.setAttribute("stroke-width", "0.05");
				circle.setAttribute("class", "draggable-point");
				circle.setAttribute("data-segment-index", segmentIndex);
				circle.setAttribute("data-point-index", pIndex);
				group.appendChild(circle);
			});
			draggableDotGroup.appendChild(group);
		});
	};
	const updateDashedLines = () => {
		dashedLineGroup.innerHTML = "";
		for (let i = 1; i < axis.length; i++) {
			const prevSegment = axis[i - 1];
			const currentSegment = axis[i];
			if (currentSegment.type === "Q" && currentSegment.points.length === 2) {
				const prevPoint = prevSegment.points[prevSegment.points.length - 1];
				const controlPoint = currentSegment.points[0];
				const endPoint = currentSegment.points[1];
				const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
				group.setAttribute("data-point-title", "Q");
				group.setAttribute("data-point-id", i);
				const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
				line1.setAttribute("x1", prevPoint.x);
				line1.setAttribute("y1", prevPoint.y);
				line1.setAttribute("x2", controlPoint.x);
				line1.setAttribute("y2", controlPoint.y);
				line1.setAttribute("stroke", "hsl(210deg 10% 80%)");
				line1.setAttribute("stroke-dasharray", "0.2, 0.2");
				line1.setAttribute("stroke-width", "0.05");
				line1.classList.add("dashed-line");
				group.appendChild(line1);
				const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
				line2.setAttribute("x1", endPoint.x);
				line2.setAttribute("y1", endPoint.y);
				line2.setAttribute("x2", controlPoint.x);
				line2.setAttribute("y2", controlPoint.y);
				line2.setAttribute("stroke", "hsl(210deg 10% 80%)");
				line2.setAttribute("stroke-dasharray", "0.2, 0.2");
				line2.setAttribute("stroke-width", "0.05");
				line2.classList.add("dashed-line");
				group.appendChild(line2);
				dashedLineGroup.appendChild(group);
			} else if (currentSegment.type === "C" && currentSegment.points.length === 3) {
				const prevPoint = prevSegment.points[prevSegment.points.length - 1];
				const control1 = currentSegment.points[0];
				const control2 = currentSegment.points[1];
				const endPoint = currentSegment.points[2];
				const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
				group.setAttribute("data-point-title", "C");
				group.setAttribute("data-point-id", i);
				const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
				line1.setAttribute("x1", prevPoint.x);
				line1.setAttribute("y1", prevPoint.y);
				line1.setAttribute("x2", control1.x);
				line1.setAttribute("y2", control1.y);
				line1.setAttribute("stroke", "hsl(210deg 10% 80%)");
				line1.setAttribute("stroke-dasharray", "0.2, 0.2");
				line1.setAttribute("stroke-width", "0.05");
				line1.classList.add("dashed-line");
				group.appendChild(line1);
				const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
				line2.setAttribute("x1", endPoint.x);
				line2.setAttribute("y1", endPoint.y);
				line2.setAttribute("x2", control2.x);
				line2.setAttribute("y2", control2.y);
				line2.setAttribute("stroke", "hsl(210deg 10% 80%)");
				line2.setAttribute("stroke-dasharray", "0.2, 0.2");
				line2.setAttribute("stroke-width", "0.05");
				line2.classList.add("dashed-line");
				group.appendChild(line2);
				dashedLineGroup.appendChild(group);
			}
		}
	};
	const updateAll = () => {
		const pathString = generatePathString();
		generatorPath.setAttribute("d", pathString);
		updateDraggableDots();
		updateDashedLines();
		updateTextareaPath();
		const pathStrokeWidth = parseFloat(sizePath.value);
		generatorPath.setAttribute("stroke-width", pathStrokeWidth);
	};
	const getPointFromEvent = (e) => {
		const CTM = svgElement.getScreenCTM();
		if (CTM === null) return null;
		const svgPoint = svgElement.createSVGPoint();
		svgPoint.x = e.clientX;
		svgPoint.y = e.clientY;
		const transformPoint = svgPoint.matrixTransform(CTM.inverse());
		const spacing = parseFloat(gridSpacingInput.value);
		return {
			x: Math.round(transformPoint.x / spacing) * spacing,
			y: Math.round(transformPoint.y / spacing) * spacing
		};
	};
	const handleMouseDown = (e) => {
		if (e.target.classList.contains("draggable-point")) {
			currentDrag = {
				element: e.target,
				segmentIndex: parseInt(e.target.getAttribute("data-segment-index")),
				pointIndex: parseInt(e.target.getAttribute("data-point-index"))
			};
		}
	};
	const handleMouseMove = (e) => {
		if (currentDrag) {
			e.preventDefault();
			const newPoint = getPointFromEvent(e);
			if (newPoint) {
				const {segmentIndex, pointIndex} = currentDrag;
				axis[segmentIndex].points[pointIndex].x = newPoint.x;
				axis[segmentIndex].points[pointIndex].y = newPoint.y;
				updateAll();
			}
		}
	};
	const handleMouseUp = () => {
		currentDrag = null;
	};
	sizeGrid.addEventListener("change", () => {
		updateGrid();
	});
	sizeCircle.addEventListener("change", () => {
		updateDraggableDots();
	});
	sizePath.addEventListener("change", () => {
		const pathStrokeWidth = parseFloat(sizePath.value);
		generatorPath.setAttribute("stroke-width", pathStrokeWidth);
	});
	svg_width_input.addEventListener("change", () => {
		updateGrid();
	});
	svg_height_input.addEventListener("change", () => {
		updateGrid();
	});
	gridSpacingInput.addEventListener("change", () => {
		updateGrid();
	});
	addPointButton.addEventListener("click", () => {
		const lastPoint = axis[axis.length - 1].points.slice(-1)[0];
		const newPointX = lastPoint.x + 1;
		const newPointY = lastPoint.y;
		const selectedOption = document.querySelector('input[name="btn-option"]:checked').value;
		let newSegment = null;
		switch (selectedOption) {
			case "option-line":
				newSegment = {
					type: "L",
					points: [{x: newPointX, y: newPointY}]
				};
				break;
			case "option-quadratic":
				newSegment = {
					type: "Q",
					points: [{x: newPointX,y: newPointY}, {x: newPointX + 1,y: newPointY}]
				};
				break;
			case "option-cubic":
				newSegment = {
					type: "C",
					points: [{x: newPointX,y: newPointY}, {x: newPointX + 1,y: newPointY}, {x: newPointX + 2,y: newPointY}]
				};
				break;
			default:
				return;
		}
		axis.push(newSegment);
		updateAll();
	});
	removePointButton.addEventListener("click", () => {
		if (axis.length > 1) {
			axis.pop();
			updateAll();
		}
	});
	resetPathButton.addEventListener("click", () => {
		axis = [
			{
				type: "M",
				points: [{x: 1, y: 2}]
			}
		];
		updateAll();
	});
	showGridCheckbox.addEventListener("change", () => {
		backgroundGrid.style.display = showGridCheckbox.checked ? "" : "none";
	});
	showPointsCheckbox.addEventListener("change", () => {
		draggableDotGroup.style.display = showPointsCheckbox.checked ? "" : "none";
		dashedLineGroup.style.display = showPointsCheckbox.checked ? "" : "none";
	});
	closePathCheckbox.addEventListener("change", () => {
		updateAll();
	});
	svgElement.addEventListener("mousedown", handleMouseDown);
	svgElement.addEventListener("mousemove", handleMouseMove);
	svgElement.addEventListener("mouseup", handleMouseUp);
	svgElement.addEventListener("mouseleave", handleMouseUp);
	updateGrid();
	updateAll();
});